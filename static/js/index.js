document.addEventListener('DOMContentLoaded', () => {
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

    const noteLabels = {
        'c': [
            'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B', 'c'
        ],
        'do-si': [
            'Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si', 'do'
        ],
        'do-ti': [
            'Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Ti', 'do'
        ]
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

    function clearNoteLabels() {
        for (let i=0; i<keys.length; i++) {
            keys[i].firstElementChild.innerHTML = '';
        }
    }

    function setNoteLabels(labels) {
        for (let i=0; i<keys.length; i++) {
            keys[i].firstElementChild.textContent = labels[i];
        }
    }

    const noteLabelsOption = document.getElementById('note-labels');
    noteLabelsOption.addEventListener('change', () => {
        if (noteLabelsOption.value === 'none') {
            clearNoteLabels();
        } else {
            setNoteLabels(noteLabels[noteLabelsOption.value]);
        }
    });

    function replayActiveNote() {
        const key = activeNote.key;
        key.click();  // off
        key.click();  // on
    }

    const octaveOption = document.getElementById('octave');
    octaveOption.addEventListener('change', () => {
        currentOctave = Number(octaveOption.value);
        if (activeNote) {
            // replay the same note but with the new octave
            replayActiveNote();
        }
    });
});
