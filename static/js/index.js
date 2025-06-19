document.addEventListener('DOMContentLoaded', () => {
    const context = new window.AudioContext();

    const notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

    const TwelveEqualTemperament = {
        SEMITONE_RATIO: 2**(1/12),
        aIndex: notes.indexOf('a'),

        /**
         * Get the frequency of a note using the frequency of A as reference.
         *
         * @param {string} note The desired note. It should match one of the
         *      `data-note` values of the keyboard keys.
         * @param {number} aFrequency The frequency of A, to be used as reference.
         *
         * @returns {number} The frequency of the desired note.
         */
        getNoteFrequencyFromA(note, aFrequency) {
            // the formula for calculating absolute frequencies using A as reference is:
            // Pa * (2^(1/12))^(n-a)
            // where:
            //     Pa = the frequency of A (the reference)
            //     n-a = the distance/difference in semitones between the desired
            //         pitch and A
            //
            // adapted from the section "Calculating absolute frequencies" of:
            // https://en.wikipedia.org/wiki/12_equal_temperament
            const semitonesDistance = notes.indexOf(note) - this.aIndex;
            return aFrequency * (this.SEMITONE_RATIO ** semitonesDistance)
        },

        /**
         * Transpose a note's frequency down by a number of semitones.
         *
         * @param {number} frequency The frequency in Hert of the note to be transposed.
         * @param {number} semitones The number of semitones to lower the note.
         *
         * @returns {number} The transposed frequency.
         *
         * @example
         * // transpose an A4 (440 Hz) 2 semitones down
         * TwelveEqualTemperament.transposeDown(440, 2);  // returns approx. 391.99 (G4)
         */
        transposeDown(frequency, semitones) {
            return frequency / (this.SEMITONE_RATIO ** semitones);
        },
    }

    const scaleLength = notes.length;

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
        Transposition: {
            key: 'transposition',
            default: 0,
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

    tuningOption.addEventListener('change', () => {
        currentTuning = Number(tuningOption.value);
        Options.set(Options.TuningStandard.key, currentTuning);

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
        '6': 4,
        '7': 8,
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

    const transpositionOption = document.getElementById('transposition');
    transpositionOption.value = (
        Options.get(Options.Transposition.key)
        || Options.Transposition.default
    );
    let semitonesToTranspose = Number(transpositionOption.value);
    transpositionOption.addEventListener('change', () => {
        semitonesToTranspose = Number(transpositionOption.value);
        Options.set(Options.Transposition.key, semitonesToTranspose);

        if (activeKeys.length > 0) {
            // replay the same note(s) but with the new transposition
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

            const baseFrequency = TwelveEqualTemperament.getNoteFrequencyFromA(
                key.dataset.note, currentTuning
            );

            let frequency = (
                baseFrequency
                * octaveMultipliers[currentOctave]
                * keyOctaveMultiplier
            );

            if (semitonesToTranspose) {
                frequency = TwelveEqualTemperament.transposeDown(
                    frequency, semitonesToTranspose
                );
            }

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

    function stopActiveKeys() {
        const activeKeyIds = activeKeys.map(key => key.id);

        for (const id of activeKeyIds) {
            const key = document.getElementById(id);
            key.click();  // off
        }
    }

    const controlToKeyMapping = {
        '1': keys[0],
        '2': keys[1],
        '3': keys[2],
        '4': keys[3],
        '5': keys[4],
        '6': keys[5],
        '7': keys[6],
        '8': keys[7],
        '9': keys[8],
        '0': keys[9],
        '-': keys[10],
        '=': keys[11],
        'Backspace': keys[12],
    };

    function increaseOctave() {
        const lastIndex = octaveOption.childElementCount - 1;
        if (octaveOption.selectedIndex+1 > lastIndex) {
            // already at the max
            return;
        }

        octaveOption.selectedIndex += 1;
        // reflect changes
        octaveOption.dispatchEvent(new Event('change'));
    }

    function decreaseOctave() {
        if (octaveOption.selectedIndex-1 < 0) {
            // already at the minimum
            return;
        }

        octaveOption.selectedIndex -= 1;
        octaveOption.dispatchEvent(new Event('change'));
    }

    function toggleTwoVoices() {
        twoVoicesOption.checked = !twoVoicesOption.checked;
        twoVoicesOption.dispatchEvent(new Event('change'));
    }

    addEventListener("keydown", (event) => {
        // whether the key was pressed while the user was focusing on an option
        // dropdown.
        // used so we don't interfere with the option's default controls (up/down for
        // cycling between <option>s inside the <select>)
        const pressedInsideDropdown = event.target.nodeName === 'SELECT';
        if (event.defaultPrevented || pressedInsideDropdown) {
            return;
        }

        const correspondentKey = controlToKeyMapping[event.key];
        if (correspondentKey) {
            correspondentKey.click();
        } else if (event.key === 'ArrowUp' || event.key === 'k') {
            increaseOctave();
        } else if (event.key === 'ArrowDown' || event.key === 'j') {
            decreaseOctave();
        } else if (event.key === 'v') {
            toggleTwoVoices();
        } else if (event.key === 'Escape') {
            stopActiveKeys();
        } else {
            return;
        }

        // avoid handling the default action twice
        event.preventDefault();
    }, true);
});
