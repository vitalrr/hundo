"""Original synthesized game cues; no external recordings or samples."""
import math
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)

def make(name, duration, notes):
    samples = [0.0] * int(duration * RATE)
    for start, length, frequency, volume in notes:
        for n in range(int(length * RATE)):
            i = int(start * RATE) + n
            if i >= len(samples):
                break
            t = n / RATE
            envelope = min(1, t / .008) * max(0, 1 - t / length) ** 2
            samples[i] += volume * envelope * (math.sin(2 * math.pi * frequency * t) + .15 * math.sin(4 * math.pi * frequency * t))
    with wave.open(str(OUT / name), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(b''.join(struct.pack('<h', int(max(-.85, min(.85, x)) * 32767)) for x in samples))

make('tick.wav', .16, [(0, .13, 880, .35)])
make('start.wav', .65, [(0, .2, 523.25, .35), (.12, .2, 659.25, .35), (.24, .38, 1046.5, .35)])
make('correct.wav', .7, [(0, .22, 659.25, .3), (.15, .22, 783.99, .3), (.3, .38, 1046.5, .35)])
make('out.wav', .55, [(0, .28, 392, .3), (.18, .35, 261.63, .3)])
notes = []
for i, frequency in enumerate([261.63, 329.63, 392, 523.25, 440, 392, 329.63, 392]):
    notes.append((i * .5, .32, frequency, .22))
    notes.append((i * .5, .18, 65.41 if i < 4 else 55, .3))
make('pulse.wav', 4, notes)

# One mixed track keeps Android audio focus on a single player throughout
# the countdown; independent tick players can interrupt the music.
countdown = []
for repeat in range(4):
    countdown.extend((start + repeat * 4, length, frequency, volume * .75)
                     for start, length, frequency, volume in notes)
countdown.extend((second, .13, 880, .3) for second in range(15))
make('countdown.wav', 15, countdown)
