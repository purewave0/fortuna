const context = new window.AudioContext();

// 4th octave in scientific pitch notation
const noteFrequencies = {
    'c':  261.63,
    'c#': 277.18,
    'd':  293.66,
    'd#': 311.13,
    'e':  329.63,
    'f':  349.23,
    'f#': 369.99,
    'g':  392,
    'g#': 415.3,
    'a':  440,
    'a#': 466.16,
    'b':  493.88,
}

const octaveMultipliers = {
    '1': 0.125,
    '2': 0.25,
    '3': 0.5,
    '4': 1,
    '5': 2,
    '6': 3,
    '7': 4,
}

function playNote(hertz) {
    const oscillator = context.createOscillator();

    oscillator.type = 'square';
    oscillator.frequency.value = hertz;
    oscillator.connect(context.destination);
    oscillator.start();

    return oscillator;
}


let activeNote = null;
let currentOctave = 4;

const keys = document.getElementsByClassName('key');

for (const key of keys) {
    key.addEventListener('click', () => {
        const keyOctaveMultiplier = (key.dataset.octaveMultiplier)
            ? Number(key.dataset.octaveMultiplier)
            : 1;

        if (activeNote) {
            // TODO: add polyphonic mode
            activeNote.oscillator.stop();
            activeNote.key.classList.remove('active');

            const pressedActiveNote = (
                activeNote.name === key.dataset.note
                && activeNote.keyOctaveMultiplier === keyOctaveMultiplier
            )
            activeNote = null;

            if (pressedActiveNote) {
                return;
            }
        }

        const frequency = (
            noteFrequencies[key.dataset.note]
            * octaveMultipliers[currentOctave]
            * keyOctaveMultiplier
        );

        key.classList.add('active');

        activeNote = {
            name: key.dataset.note, 
            oscillator: playNote(frequency),
            keyOctaveMultiplier: keyOctaveMultiplier,
            key: key,
        }
    });
}
