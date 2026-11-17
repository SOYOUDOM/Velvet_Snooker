"""Turn a Rocketbox animation (converted from FBX with FBX2glTF) into a VELVET motion clip:
the root keeps its own height track; every other bone's position track becomes an offset from the
bone's rest position (People.fit adds it back on each body), unused tracks are dropped and the keys
are thinned to the motion that is really there. Compress the result afterwards with
`gltf-transform meshopt`.

usage: python3 prep_clip.py <raw.glb> <out.glb>
"""
import json
import struct
import sys

import numpy as np

QUAT_TOL, POS_TOL = 0.0012, 0.0004


def read_glb(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    m = struct.unpack('<I', b[20 + n:24 + n])[0]
    return j, b[28 + n:28 + n + m]


def accessor(j, binary, i):
    a = j['accessors'][i]
    v = j['bufferViews'][a['bufferView']]
    k = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    assert a['componentType'] == 5126
    arr = np.frombuffer(binary, '<f4', a['count'] * k, off)
    return arr.reshape(a['count'], k) if k > 1 else arr.copy()


def thin(t, v, tol):
    """Keep only the keys that linear interpolation between kept keys cannot reproduce."""
    keep, a = [0], 0
    for b in range(2, len(t)):
        seg = slice(a + 1, b)
        u = ((t[seg] - t[a]) / (t[b] - t[a]))[:, None]
        if np.abs(v[a] + (v[b] - v[a]) * u - v[seg]).max() > tol:
            keep.append(b - 1)
            a = b - 1
    keep.append(len(t) - 1)
    return t[keep], v[keep]


def main(src, dst):
    j, binary = read_glb(src)
    anim = j['animations'][0]
    nodes = j['nodes']
    out_nodes, chans, blobs = [], [], []
    node_index = {}
    for ch in anim['channels']:
        tgt, path = ch['target']['node'], ch['target']['path']
        name = nodes[tgt].get('name', f'n{tgt}')
        if path not in ('rotation', 'translation') or 'Footsteps' in name:
            continue
        smp = anim['samplers'][ch['sampler']]
        t = accessor(j, binary, smp['input']).astype(np.float64)
        v = accessor(j, binary, smp['output']).astype(np.float64)
        if path == 'translation' and name != 'Bip01':
            v = v - np.array(nodes[tgt].get('translation', [0, 0, 0]))       # an offset from the rest position
            if np.abs(v).max() < 2e-4:
                continue
        if path == 'rotation':
            for i in range(1, len(v)):                                          # no sign flips between keys
                if np.dot(v[i], v[i - 1]) < 0:
                    v[i] = -v[i]
        t2, v2 = thin(t, v, QUAT_TOL if path == 'rotation' else POS_TOL)
        if name not in node_index:
            node_index[name] = len(out_nodes)
            out_nodes.append({'name': name})
        chans.append((node_index[name], path, t2.astype('<f4'), v2.astype('<f4')))
    # write a small glTF: one node per animated bone, one animation
    bin_parts, views, accs, samplers, channels = [], [], [], [], []
    offset = 0

    def add(arr, typ, minmax=False):
        nonlocal offset
        data = arr.tobytes()
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)})
        acc = {'bufferView': len(views) - 1, 'componentType': 5126, 'count': len(arr), 'type': typ}
        if minmax:
            acc['min'], acc['max'] = [float(arr.min())], [float(arr.max())]
        accs.append(acc)
        bin_parts.append(data)
        offset += len(data)
        return len(accs) - 1

    for node, path, t, v in chans:
        ti = add(t, 'SCALAR', True)
        vi = add(v, 'VEC4' if path == 'rotation' else 'VEC3')
        samplers.append({'input': ti, 'output': vi, 'interpolation': 'LINEAR'})
        channels.append({'sampler': len(samplers) - 1, 'target': {'node': node, 'path': path}})
    blob = b''.join(bin_parts)
    gj = {'asset': {'version': '2.0', 'generator': 'VELVET prep_clip'}, 'nodes': out_nodes,
          'scene': 0, 'scenes': [{'nodes': list(range(len(out_nodes)))}],
          'animations': [{'name': anim.get('name', 'clip'), 'samplers': samplers, 'channels': channels}],
          'buffers': [{'byteLength': len(blob)}], 'bufferViews': views, 'accessors': accs}
    js = json.dumps(gj, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    blob += b'\0' * (-len(blob) % 4)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(blob), 0x004E4942) + blob)
    dur = max(float(t[-1]) for _, _, t, _ in chans)
    print(f'{dst}: {len(channels)} tracks, {dur:.1f} s, {offset // 1024} KB before compression')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
