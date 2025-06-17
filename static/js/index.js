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


    let activeKeys = [];
    let currentOctave = 4;

    // TODO: tuning system (equal temp., just int., pythagorean(maybe?))
    // TODO: tuning standard (a440, a442...)
    // TODO: (as a prerequisite for the above) calculate pitches according to the
    // system and the standard
    // TODO: keyboard controls (QWERTY... and, maybe, CDEF... + modifiers)
    // TODO: chord mode?
    const modeOption = document.getElementById('mode');
    let isTwoVoices = modeOption.checked;
    modeOption.addEventListener('change', () => {
        isTwoVoices = modeOption.checked;
        if (!isTwoVoices && activeKeys.length > 1) {
            // reverting to one-voice mode. turn off the 2nd key
            const secondActiveKey = activeKeys[1];
            secondActiveKey.oscillator.stop();
            secondActiveKey.key.classList.remove('active');
            activeKeys.pop()
        }
    });

    const keys = document.getElementsByClassName('key');
    for (const key of keys) {
        key.addEventListener('click', () => {
            const keyOctaveMultiplier = (key.dataset.octaveMultiplier)
                ? Number(key.dataset.octaveMultiplier)
                : 1;

            if (activeKeys.length > 0) {
                const correspondentKeyIndex = activeKeys.findIndex(
                    (activeKey) => activeKey.id === key.id
                );
                const clickedOnActiveKey = correspondentKeyIndex !== -1;
                if (clickedOnActiveKey) {
                    // clicking on any active key, no matter the mode, always turns it
                    // off
                    const correspondentKey = activeKeys[correspondentKeyIndex];
                    correspondentKey.oscillator.stop();
                    correspondentKey.key.classList.remove('active');

                    activeKeys.splice(correspondentKeyIndex, 1);
                    return;
                }

                // is clicking on a new key. limit the number of active notes
                // according to the current mode
                if (
                    !isTwoVoices
                    || (isTwoVoices && activeKeys.length === 2)
                ) {
                    const lastIndex = activeKeys.length - 1;
                    // in two-voices mode, this keeps the first one ("root") and stops
                    // the last one
                    const oldKey = activeKeys[lastIndex];
                    oldKey.oscillator.stop();
                    oldKey.key.classList.remove('active');
                    activeKeys.pop();
                }
            }

            const frequency = (
                noteFrequencies[key.dataset.note]
                * octaveMultipliers[currentOctave]
                * keyOctaveMultiplier
            );

            key.classList.add('active');

            const activeKey = {
                id: key.id,
                note: key.dataset.note,
                oscillator: playNote(frequency),
                octaveMultiplier: keyOctaveMultiplier,
                key: key,
            }
            activeKeys.push(activeKey);
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

    function replayActiveKeys() {
        const activeKeyIds = activeKeys.map(key => key.id);

        // can't iterate activeKeys for this because its size will change. use the
        // stored key ids to directly replay them
        for (const id of activeKeyIds) {
            const key = document.getElementById(id);
            key.click();  // off
            key.click();  // on
        }
    }

    const octaveOption = document.getElementById('octave');
    octaveOption.addEventListener('change', () => {
        currentOctave = Number(octaveOption.value);
        if (activeKeys.length > 0) {
            // replay the same note(s) but with the new octave
            replayActiveKeys();
        }
    });
});
