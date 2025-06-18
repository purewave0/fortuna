document.addEventListener('DOMContentLoaded', () => {
    const context = new window.AudioContext();

    function get12EqualTemperamentFromA4(a4Frequency) {
        // in 12 equal temperament, adjacent semitones have a ratio of the 12th root of
        // 2 (or 2^(1/12)) between them. to find the next semitone, we multiply the
        // current pitch by this ratio; likewise, to find the previous semitone, we
        // divide by this ratio.
        const SEMITONE_RATIO = 2**(1/12)

        return {
            'c':  a4Frequency / (SEMITONE_RATIO**9),
            'c#': a4Frequency / (SEMITONE_RATIO**8),
            'd':  a4Frequency / (SEMITONE_RATIO**7),
            'd#': a4Frequency / (SEMITONE_RATIO**6),
            'e':  a4Frequency / (SEMITONE_RATIO**5),
            'f':  a4Frequency / (SEMITONE_RATIO**4),
            'f#': a4Frequency / (SEMITONE_RATIO**3),
            'g':  a4Frequency / (SEMITONE_RATIO**2),
            'g#': a4Frequency / (SEMITONE_RATIO),
            'a':  a4Frequency,
            'a#': a4Frequency * (SEMITONE_RATIO),
            'b':  a4Frequency * (SEMITONE_RATIO**2),
        };
    }

    const Options = {
        TwoVoices: {
            key: 'two-voices',
            default: false,
        },
        NoteLabels: {
            key: 'note-labels',
            default: 'c',
        },
        Octave: {
            key: 'octave',
            default: 4,
        },
        TuningStandard: {
            key: 'tuning-standard',
            default: 440,
        },
        get(key) {
            return localStorage.getItem(key);
        },
        set(key, value) {
            localStorage.setItem(key, value);
        }
    };


    // the frequency of A4 (A in the 4th octave, in scientific pitch notation)
    const tuningOption = document.getElementById('tuning');
    tuningOption.value = (
        Options.get(Options.TuningStandard.key)
        || Options.TuningStandard.default
    );
    let currentTuning = Number(tuningOption.value);

    let noteFrequencies = get12EqualTemperamentFromA4(currentTuning);
    tuningOption.addEventListener('change', () => {
        currentTuning = Number(tuningOption.value);
        Options.set(Options.TuningStandard.key, currentTuning);
        noteFrequencies = get12EqualTemperamentFromA4(currentTuning);

        if (activeKeys.length > 0) {
            // replay the same note(s) but with the new tuning
            replayActiveKeys();
        }
    });

    const octaveMultipliers = {
        '1': 0.125,
        '2': 0.25,
        '3': 0.5,
        '4': 1,
        '5': 2,
        '6': 3,
        '7': 4,
    };

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
    };

    function playNote(hertz) {
        const oscillator = context.createOscillator();

        oscillator.type = 'square';
        oscillator.frequency.value = hertz;
        oscillator.connect(context.destination);
        oscillator.start();

        return oscillator;
    }


    let activeKeys = [];

    // TODO: tuning system (equal temp., just int., pythagorean(maybe?))
    // TODO: keyboard controls (QWERTY... and, maybe, CDEF... + modifiers)
    // TODO: chord mode?
    const twoVoicesOption = document.getElementById('two-voices');
    twoVoicesOption.checked = (
        (Options.get(Options.TwoVoices.key) === 'true')
        || Options.TwoVoices.default
    );
    let isTwoVoices = twoVoicesOption.checked;
    twoVoicesOption.addEventListener('change', () => {
        isTwoVoices = twoVoicesOption.checked;
        Options.set(Options.TwoVoices.key, isTwoVoices);

        if (!isTwoVoices && activeKeys.length > 1) {
            // reverting to one-voice mode. turn off the 2nd key
            const secondActiveKey = activeKeys[1];
            secondActiveKey.oscillator.stop();
            secondActiveKey.key.classList.remove('active');
            activeKeys.pop()
        }
    });

    const octaveOption = document.getElementById('octave');
    octaveOption.value = (
        Options.get(Options.Octave.key)
        || Options.Octave.default
    );
    let currentOctave = Number(octaveOption.value);
    octaveOption.addEventListener('change', () => {
        currentOctave = Number(octaveOption.value);
        Options.set(Options.Octave.key, currentOctave);

        if (activeKeys.length > 0) {
            // replay the same note(s) but with the new octave
            replayActiveKeys();
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
    noteLabelsOption.value = (
        Options.get(Options.NoteLabels.key)
        || Options.NoteLabels.default
    );
    if (noteLabelsOption.value === 'none') {
        clearNoteLabels();
    } else {
        setNoteLabels(noteLabels[noteLabelsOption.value]);
    }

    noteLabelsOption.addEventListener('change', () => {
        if (noteLabelsOption.value === 'none') {
            clearNoteLabels();
        } else {
            setNoteLabels(noteLabels[noteLabelsOption.value]);
        }

        Options.set(Options.NoteLabels.key, noteLabelsOption.value);
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
});
