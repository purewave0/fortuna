document.addEventListener('DOMContentLoaded', () => {
    const context = new window.AudioContext();

    const notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const scaleLength = notes.length;
    const aIndex = notes.indexOf('a');

    const TwelveEqualTemperament = {
        SEMITONE_RATIO: 2**(1/12),

        /**
         * Get the frequency of a note using the frequency of A as reference.
         *
         * @param {string} note The desired note. It should match one of the
         *     `data-note` values of the keyboard keys.
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
            const semitonesDistance = notes.indexOf(note) - aIndex;
            return aFrequency * (this.SEMITONE_RATIO ** semitonesDistance)
        },

        /**
         * Transpose a note's frequency down by a number of semitones.
         *
         * @param {number} frequency The frequency in Hertz of the note to be
         *      transposed.
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
    };

    const JustIntonation = {
        ratioByInterval: {
            0:  1/1,    // unison
            1:  16/15,  // minor 2nd
            2:  9/8,    // major 2nd
            3:  6/5,    // minor 3rd
            4:  5/4,    // major 3rd
            5:  4/3,    // perfect 4th
            6:  45/32,  // tritone
            7:  3/2,    // perfect 5th
            8:  8/5,    // minor 6th
            9:  5/3,    // major 6th
            10: 16/9,   // minor 7th
            11: 15/8,   // major 7th
            12: 2/1,    // octave
        },

        /**
         * Get the frequency of the root note using the frequency of A as reference.
         *
         * @param {string} rootNote The desired note. It should match one of the
         *      `data-note` values of the keyboard keys.
         * @param {number} aFrequency The frequency of A, which is the reference.
         * @param {number} semitonesToTranspose The number of semitones to transpose
         *     down. Default is 0.
         *
         * @returns {number} The frequency of the root note.
         */
        getRootFrequencyFromA(rootNote, aFrequency, semitonesToTranspose=0) {
            // our initial reference is A. transposing N semitones down can be viewed
            // as starting at A (the reference), moving N semitones up, and choosing the
            // note we land on as the new reference.
            // for example, with A=440, transposing 2 semitones down means we'll start
            // at A and go 2 semitones up: A, A#, *B*. B will now be our reference note,
            // equal to 440 Hz.
            let newReferenceNoteIndex = (aIndex + semitonesToTranspose) % scaleLength;

            let octaveMultiplier = 1;
            const shouldNormaliseOctave =
                (aIndex+semitonesToTranspose) > scaleLength-1;
            if (shouldNormaliseOctave) {
                // we wrapped around; decrease 1 octave
                octaveMultiplier *= 0.5
            }

            // now, for the frequency: first, find the relationship between the root and
            // our reference
            let semitonesDistance = notes.indexOf(rootNote) - newReferenceNoteIndex;

            if (semitonesDistance < 0) {
                // the root is LOWER than our reference, so we wrapped around. normalise
                // the distance but decrease 1 octave accordingly
                octaveMultiplier *= 0.5;
                semitonesDistance += 12;
            }
            const ratio = this.ratioByInterval[semitonesDistance];

            return aFrequency * octaveMultiplier * ratio;
        },


        /**
         * Get the frequency of a note based on the frequency of another note as root.
         * Transposition of the root, if desired, should be done beforehand.
         *
         * @param {string} note The desired note. It should match one of the
         *     `data-note` values of the keyboard keys.
         * @param {string} rootNote The note the scale is based on. Should also match
         *     `data-note` values.
         * @param {number} rootFrequency The frequency of the root note.
         *
         * @returns {number} The frequency of the desired note.
         */
        getNoteFrequencyFromRoot(
            note,
            rootNote,
            rootFrequency,
        ) {
            // first, find the relationship between this note and the root
            let semitonesDistance = notes.indexOf(note) - notes.indexOf(rootNote);

            let octaveMultiplier = 1;
            if (semitonesDistance < 0) {
                // desired note is LOWER than the root. normalise the distance but
                // decrease 1 octave accordingly
                octaveMultiplier = 0.5;
                semitonesDistance += 12;
            }
            const ratio = this.ratioByInterval[semitonesDistance];

            return rootFrequency * octaveMultiplier * ratio;
        },
    }


    const Options = {
        Mode: {
            key: 'mode',
            default: 'single-voice',
        },
        NoteLabels: {
            key: 'note-labels',
            default: 'c',
        },
        Octave: {
            key: 'octave',
            default: 4,
        },
        TuningSystem: {
            key: 'tuning-system',
            default: '12et',
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


    // the system of spacing between the frequencies
    const tuningSystemOption = document.getElementById('tuning-system');
    tuningSystemOption.value = (
        Options.get(Options.TuningSystem.key)
        || Options.TuningSystem.default
    );
    let currentTuningSystem = tuningSystemOption.value;

    tuningSystemOption.addEventListener('change', () => {
        currentTuningSystem = tuningSystemOption.value;
        Options.set(Options.TuningSystem.key, currentTuningSystem);

        if (activeKeys.length > 0) {
            // replay the same note(s) but with the new tuning system
            replayActiveKeys();
        }
    });

    // the frequency of A4 (A in the 4th octave, in scientific pitch notation)
    const tuningStandardOption = document.getElementById('tuning-standard');
    tuningStandardOption.value = (
        Options.get(Options.TuningStandard.key)
        || Options.TuningStandard.default
    );
    let currentTuningStandard = Number(tuningStandardOption.value);

    tuningStandardOption.addEventListener('change', () => {
        currentTuningStandard = Number(tuningStandardOption.value);
        Options.set(Options.TuningStandard.key, currentTuningStandard);

        if (activeKeys.length > 0) {
            // replay the same note(s) but with the new tuning standard
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


    function playNote(hertz, volume) {
        const oscillator = context.createOscillator();

        const gain = context.createGain();
        gain.gain.value = volume;
        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.value = hertz;
        oscillator.start();

        return oscillator;
    }


    let activeKeys = [];

    // TODO: chord mode?
    const modeOption = document.getElementById('mode');
    modeOption.value = (
        Options.get(Options.Mode.key) || Options.Mode.default
    );
    let currentMode = modeOption.value;
    modeOption.addEventListener('change', () => {
        currentMode = modeOption.value;
        Options.set(Options.Mode.key, currentMode);

        if (currentMode === 'single-voice' && activeKeys.length > 1) {
            // reverting to single-voice mode. turn off the 2nd key
            const secondActiveKey = activeKeys[1];
            secondActiveKey.oscillator.stop();
            secondActiveKey.key.classList.remove('root', 'secondary');
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
                    correspondentKey.key.classList.remove('root', 'secondary');

                    activeKeys.splice(correspondentKeyIndex, 1);

                    const wasRootStopped = correspondentKeyIndex === 0;
                    if (
                        activeKeys.length === 1
                        && wasRootStopped
                    ) {
                        // the old root was turned off, so the remaining active key
                        // should be the new root. replay keys because
                        // 1. for JI, its frequency is still based on the old root; so
                        // it should be readjusted (for 12ET this doesn't matter)
                        // 2. it will correctly set the css 'root' class for the key
                        replayActiveKeys();
                    }
                    return;
                }

                // is clicking on a new key. limit the number of active notes
                // according to the current mode
                if (
                    currentMode === 'single-voice'
                    || (currentMode === 'two-voice' && activeKeys.length === 2)
                ) {
                    const lastIndex = activeKeys.length - 1;
                    // in two-voices mode, this keeps the first one ("root") and stops
                    // the last one
                    const oldKey = activeKeys[lastIndex];
                    oldKey.oscillator.stop();
                    oldKey.key.classList.remove('root', 'secondary');
                    activeKeys.pop();
                }
            }

            let baseFrequency = null;
            if (currentTuningSystem === '12et') {
                baseFrequency = TwelveEqualTemperament.getNoteFrequencyFromA(
                    key.dataset.note, currentTuningStandard
                );
                if (semitonesToTranspose) {
                    baseFrequency = TwelveEqualTemperament.transposeDown(
                        baseFrequency, semitonesToTranspose
                    );
                }
            } else if (currentTuningSystem === 'just-intonation') {
                // in Just Intonation, the frequency will depend on whether this is the
                // FIRST note (A as reference), or just an interval (root as reference)
                const isRootPlaying = activeKeys.length > 0;
                if (isRootPlaying) {
                    // we'll just be playing an interval based on the root then
                    const rootKey = activeKeys[0];
                    baseFrequency = JustIntonation.getNoteFrequencyFromRoot(
                        key.dataset.note,
                        rootKey.note,
                        rootKey.baseFrequency,
                        // using baseFrequency as it's not affected by the octave
                        // multiplier
                    )
                } else {
                    // we're going to play the FIRST note
                    baseFrequency = JustIntonation.getRootFrequencyFromA(
                        key.dataset.note, currentTuningStandard, semitonesToTranspose
                    );
                }
            }


            let frequency = (
                baseFrequency
                * octaveMultipliers[currentOctave]
                * keyOctaveMultiplier
            );

            const isRoot = activeKeys.length === 0;
            if (isRoot) {
                key.classList.add('root');
            } else {
                key.classList.add('secondary');
            }

            const activeKey = {
                id: key.id,
                note: key.dataset.note,
                baseFrequency: baseFrequency,
                oscillator: playNote(
                    frequency,
                    (isRoot) ? 0.6 : 0.4
                ),
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
        }

        for (const id of activeKeyIds) {
            const key = document.getElementById(id);
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

    function cycleMode() {
        const lastIndex = modeOption.childElementCount - 1;
        if (modeOption.selectedIndex+1 > lastIndex) {
            // at the end; wrap around
            modeOption.selectedIndex = 0;
        } else {
            modeOption.selectedIndex += 1;
        }

        modeOption.dispatchEvent(new Event('change'));
    }

    function cycleTuningSystems() {
        const lastIndex = tuningSystemOption.childElementCount - 1;
        if (tuningSystemOption.selectedIndex+1 > lastIndex) {
            // at the end; wrap around
            tuningSystemOption.selectedIndex = 0;
        } else {
            tuningSystemOption.selectedIndex += 1;
        }

        tuningSystemOption.dispatchEvent(new Event('change'));
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
        } else if (event.key === 'm') {
            cycleMode();
        } else if (event.key === 't') {
            cycleTuningSystems();
        } else if (event.key === 'Escape') {
            stopActiveKeys();
        } else {
            return;
        }

        // avoid handling the default action twice
        event.preventDefault();
    }, true);

    // interface interaction

    const allOptions = document.querySelectorAll('.option select, .option input');

    const hidePanel = document.getElementById('bottom-panel-hide');
    hidePanel.addEventListener('click', () => {
        if (!document.body.classList.contains('hiding-bottom-panel')) {
            document.body.classList.add('hiding-bottom-panel');
            hidePanel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M120-120v-240h80v104l124-124 56 56-124 124h104v80H120Zm516-460-56-56 124-124H600v-80h240v240h-80v-104L636-580Z"/></svg>';
            for (const option of allOptions) {
                option.disabled = true;
            }
        } else {
            document.body.classList.remove('hiding-bottom-panel');
            hidePanel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white"><path d="m177-120-57-57 184-183H200v-80h240v240h-80v-104L177-120Zm343-400v-240h80v104l183-184 57 57-184 183h104v80H520Z"/></svg>';
            for (const option of allOptions) {
                option.disabled = false;
            }
        }
    });

    const howtoButton = document.getElementById('show-howto');
    howtoButton.addEventListener('click', () => {
        MicroModal.show('modal-howto');
    });

    const aboutButton = document.getElementById('show-about');
    aboutButton.addEventListener('click', () => {
        MicroModal.show('modal-about');
    });
});
