"""Offline voice engines for the VELVET commentary team.

Kokoro (kokoro-onnx), Supertonic 3 (sherpa-onnx) and Piper voices (piper-tts runtime).
Models live in VELVET_VOX (default /tmp/vox), unpacked from the sherpa-onnx "tts-models" release:
  sherpa-onnx-supertonic-3-tts-int8-2026-05-11, vits-piper-<voice> (each with its .onnx and .onnx.json).
"""
import os

import numpy as np

VOX = os.environ.get('VELVET_VOX', '/tmp/vox')
_kokoro, _piper, _st = None, {}, None


def kokoro_init(model, voices):
    global _kokoro
    from kokoro_onnx import Kokoro
    _kokoro = Kokoro(model, voices)


def kokoro(text, voice, lang, speed):
    """voice: a Kokoro voice name, or [(name, weight), ...] for a blend."""
    v = voice if isinstance(voice, str) else sum(w * _kokoro.get_voice_style(n) for n, w in voice)
    s, sr = _kokoro.create(text, voice=v, speed=speed, lang=lang)
    return np.asarray(s, np.float32), sr


def piper(text, name, sid, speed):
    from piper import PiperVoice, SynthesisConfig
    if name not in _piper:
        d = f'{VOX}/vits-piper-{name}'
        _piper[name] = PiperVoice.load(f'{d}/{name}.onnx', config_path=f'{d}/{name}.onnx.json')
    v = _piper[name]
    cfg = SynthesisConfig(speaker_id=sid, length_scale=1 / speed, noise_scale=.667, noise_w_scale=.8)
    sr = v.config.sample_rate
    gap, out = np.zeros(int(.18 * sr), np.float32), []   # a short breath between sentences
    for i, c in enumerate(v.synthesize(text, syn_config=cfg)):
        out += ([gap] if i else []) + [np.asarray(c.audio_float_array, np.float32)]
    return np.concatenate(out), sr


def supertonic(text, sid, speed, steps=12):
    global _st
    import sherpa_onnx as so
    if _st is None:
        S = f'{VOX}/sherpa-onnx-supertonic-3-tts-int8-2026-05-11'
        _st = so.OfflineTts(so.OfflineTtsConfig(model=so.OfflineTtsModelConfig(
            supertonic=so.OfflineTtsSupertonicModelConfig(
                duration_predictor=f'{S}/duration_predictor.int8.onnx', text_encoder=f'{S}/text_encoder.int8.onnx',
                vector_estimator=f'{S}/vector_estimator.int8.onnx', vocoder=f'{S}/vocoder.int8.onnx',
                tts_json=f'{S}/tts.json', unicode_indexer=f'{S}/unicode_indexer.bin', voice_style=f'{S}/voice.bin'),
            num_threads=2, provider='cpu')))
    g = so.GenerationConfig()
    g.sid, g.speed, g.num_steps, g.extra = sid, speed, steps, {'lang': 'en'}
    a = _st.generate(text, g)
    return np.asarray(a.samples, np.float32), a.sample_rate


def speak(spec, text, pace=1.0):
    """spec: ('ko', voice, lang, speed) | ('st', voice id, speed) | ('pi', piper voice, speaker id, speed)."""
    if spec[0] == 'st':
        return supertonic(text, spec[1], spec[2] * pace)
    if spec[0] == 'pi':
        return piper(text, spec[1], spec[2], spec[3] * pace)
    return kokoro(text, spec[1], spec[2], spec[3] * pace)
