const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz"

class WordleSolver {
    constructor(hard_mode) {
        this.word_len = 5
        this.hard_mode = hard_mode
        this._fast_word_result_buf = new Array(256).fill(0)
        this.const_first_guess = [
            ['roate', 60.42462203023758],
            ['raise', 60.99086393088553],
            ['raile', 61.33088552915767],
            ['soare', 62.30107991360691],
            ['arise', 63.71570194384449],
            ['irate', 63.7692656587473],
            ['orate', 63.89071274298056],
            ['ariel', 65.28768898488121],
            ['arose', 66.01116630669546],
            ['raine', 67.0561555075594]
        ]
    }

    async initialize() {
        const words_wordle_src = chrome.runtime.getURL("./util/words_wordle.js");
        const words_wordle = await import(words_wordle_src);
        this.all_guess_words = words_wordle.all_guess_words
        const words_wordle_solutions_src = chrome.runtime.getURL("./util/words_wordle_solutions.js");
        const words_wordle_solutions = await import(words_wordle_solutions_src);
        this.all_solution_words = words_wordle_solutions.all_solution_words
        this.reset()
    }

    static async create(hard_mode) {
        const o = new WordleSolver(hard_mode)
        await o.initialize()
        return o
    }

    static _get_letter_counts(words, all_letters = false) {
        // Returns a dict mapping each letter to counts of its occurrences.
        let r = new Map()
        for (const c of ALL_LETTERS) {
            r[c] = 0
        }
        for (const c of words) {
            r[c] = r[c] + 1
        }
        return r
    }

    static _get_letter_count_ranges_of_words(words) {
        // Given a list of words, returns a dict of the range of letter counts, inclusive, that could be in a word.
        let r = new Map()
        for (const word of words) {
            let occurrences = WordleSolver._get_letter_counts(word, true)
            for (let letter in occurrences) {
                let count = occurrences[letter]
                if (letter in r) {
                    let c = r[letter]
                    if (count < c[0])
                        c = [count, c[1]]
                    if (count > c[1])
                        c = [c[0], count]
                    r[letter] = c
                } else {
                    r[letter] = [count, count]
                }
            }
        }
        for (const letter of ALL_LETTERS) {
            if (!(letter in r))
                r[letter] = [0, 0]
        }
        return r
    }

    reset() {
        // Resets state variables related to a wordle session.
        this.positions = []
        for (let i = 0; i < this.word_len; i++) {
            this.positions.push(new Set(ALL_LETTERS))
        }
        // Map from each letter to a tuple of the upper and lower bound (inclusive) of how many of that letter may be present
        this.letter_counts = WordleSolver._get_letter_count_ranges_of_words(this.all_solution_words)
        // Set of words that have been tried so far
        this.tried_words = new Set()
        this.tried_word_list = []
        // Set of words that might be possible solutions at this point
        this.potential_solutions = new Set(this.all_solution_words)
        // Flag indicating if target has been solved
        this.solved = false
        // Queue of constant first words to guess
        this.first_word_queue = [this.const_first_guess]
        // The set of words that can be guessed is reset each time because it is modified in hard more
        this.potential_guesses = new Set(this.all_guess_words)
    }

    _fast_word_result(guess, target) {
        // Faster word evaluation for internal use
        let ret_val = 0
        let target_l_counts = this._fast_word_result_buf
        for (let i = 0; i < this.word_len; i++)
            target_l_counts[target[i].charCodeAt(0)] += 1
        let place_val = 1
        for (let i = 0; i < this.word_len; i++) {
            if (guess[i] === target[i]) {
                ret_val += place_val * 2
                target_l_counts[target[i].charCodeAt(0)] -= 1
            }
            place_val *= 3
        }
        place_val = 1
        for (let i = 0; i < this.word_len; i++) {
            let g = guess[i]
            let t = target[i]
            let ord_g = g.charCodeAt(0)
            if (g !== t && target_l_counts[ord_g] > 0) {
                ret_val += place_val
                target_l_counts[ord_g] -= 1
            }
            place_val *= 3
        }
        for (let i = 0; i < this.word_len; i++) {
            target_l_counts[target[i].charCodeAt(0)] = 0
        }
        return ret_val
    }

    update(guessed_word, result) {
        /*Updates the state with the result of a guess.

          Parameters:
              guessed_word -- The word that was guessed
              result -- A string of same length as guessed_word containing feedback codes, Each
                  char must be one of:
                  'correct' - Letter is correct & in the correct position
                  'present' - Letter is in the word but in the wrong position
                  'absent' - Letter is not in the word
         */
        console.assert(guessed_word.length === this.word_len, "guessed word is not word length")
        console.assert(result.length === this.word_len, "result length is not word length")
        // Count number of each letter in the guessed word dict[str, int]
        let guess_l_counts = WordleSolver._get_letter_counts(guessed_word, true)
        // Count number of each letter confirmed to be in the solution
        let result_l_counts = new Map()
        for (const c of ALL_LETTERS) result_l_counts[c] = 0
        for (let i = 0; i < this.word_len; i++) {
            if (result[i] === "correct" || result[i] === "present")
                result_l_counts[guessed_word[i]] += 1
        }
        // Update this.letter_counts accounting for new information
        for (const letter of Object.keys(guess_l_counts)) {
            let gc = guess_l_counts[letter]
            let rc = result_l_counts[letter]
            let c_range = this.letter_counts[letter]
            console.assert(gc >= rc, "guess count is less than result count")
            if (gc > rc) {
                // We guessed more of this letter than there are, so now we know how many of this letter there are exactly
                c_range = [rc, rc]
            } else {
                // Each instance of the letter we guessed is in the word, so this sets a lower bound on that letter count
                c_range = [rc, c_range[1]]
            }
            this.letter_counts[letter] = c_range
        }
        // Update this.positions according to position info in the result
        for (let i = 0; i < this.word_len; i++) {
            if (result[i] === "correct") {
                // This is the only letter that can be in this position
                this.positions[i] = new Set([guessed_word[i]])
            } else {
                // We know this letter cannot exist in this position
                this.positions[i].delete(guessed_word[i])
            }
        }
        // If the sum of all lower bounds on letter counts equals the word length, we know every letter in the word
        let l_bound_sum = Object.values(this.letter_counts).reduce((acc, val) => acc + val[0], 0)
        if (l_bound_sum >= this.word_len) {
            // All letters' u_bounds can be set to their l_bounds
            for (const letter of Object.keys(this.letter_counts)) {
                this.letter_counts[letter][1] = this.letter_counts[letter][0]
            }
        }
        // Update this.positions to take into account cases where we know all positions of a letter.
        // This also handles removing letters which cannot be in the solution.
        // NOTE: This could be improved by also considering positions with limited sets of potential letters
        for (const letter of Object.keys(this.letter_counts)) {
            // Count positions for which this letter is the only possibility
            let n_exclusive = 0;
            for (const l_set of this.positions)
                n_exclusive += (letter in l_set && l_set.length === 1) ? 1 : 0
            if (n_exclusive >= this.letter_counts[letter][1]) {
                // We know all the places for this letter, it cannot occur in any other positions
                for (const l_set of this.positions) {
                    if (!(letter in l_set && l_set.length === 1))
                        l_set.delete(letter)
                }
            }
        }
        // Track the guessed words
        this.tried_words.add(guessed_word)
        this.tried_word_list.push(guessed_word)
        // Update the list of valid solutions at this point
        this._filter_words_by_known_info(this.potential_solutions)
        // If in hard mode, also filter potential guesses by known info
        if (this.hard_mode)
            this._filter_words_by_known_info(this.potential_guesses)
        // After narrowing down potential solutions, letter count ranges may be narrowed as well
        this.letter_counts = WordleSolver._get_letter_count_ranges_of_words([...this.potential_solutions])
        // Check if the guessed word was the correct solution
        if (result === Array(5).fill("correct")) {
            // Correct result was guessed
            this.solved = true
            this.potential_solutions = new Set([guessed_word])
        }
    }

    // Filter potential_solutions by this regex, and also make sure letter counts are in bounds for each
    word_within_bounds(word) {
        let l_counts = WordleSolver._get_letter_counts(word, true)
        for (let letter in l_counts) {
            let [l_bound, u_bound] = this.letter_counts[letter]
            if (!(l_bound <= l_counts[letter] && l_counts[letter] <= u_bound))
                return false
        }
        return true
    }

    _filter_words_by_known_info(words) {
        // Removes words from the set that do not fit known information.
        // Filter the set of potential solutions according to which letters are allowed in which positions.
        // Do this by constructing a regex from this.positions
        let regex_str = ""
        for (const letter_set of this.positions)
            regex_str += "[" + [...letter_set].join("") + "]"

        for (const word of [...words]) {
            if (!(word.match(regex_str) && !this.tried_words.has(word) && this.word_within_bounds(word)))
                words.delete(word)
        }
    }

    get_guess() {
        function binary_insertion(arr, element) {
            return binary_helper(arr, element, 0, arr.length - 1);
        }

        function binary_helper(arr, element, lBound, uBound) {
            if (arr.length === 0) {
                arr.push(element)
            } else if (uBound - lBound <= 1) {
                // binary search ends, we need to insert the element around here
                if (element[1] < arr[lBound][1]) arr.splice(lBound, 0, element);
                else if (element[1] > arr[uBound][1]) arr.splice(uBound+1, 0, element);
                else arr.splice(uBound, 0, element);
            } else {
                // we look for the middle point
                const midPoint = Math.floor((uBound - lBound) / 2) + lBound;
                // depending on the value in the middle, we repeat the operation only on one slice of the array, halving it each time
                element[1] < arr[midPoint][1]
                  ? binary_helper(arr, element, lBound, midPoint)
                  : binary_helper(arr, element, midPoint, uBound);
            }
        }

        // Handle constant first word(s)
        if (this.potential_solutions.size === this.all_solution_words.length)
            return this.first_word_queue[0]

        if (this.potential_solutions.size === 0) {
            // There are no possible solutions
            return []
        }

        // Determine which guess words best segments the remaining solution set.
        let best_words = []

        // NOTE: If too slow, this can be sped up by restricting the potential_guesses and/or
        // potential_solutions iterations to a random sample.  This limits the iterations of this
        // O(nm) loop but does slightly decrease optimality.
        for (const word of this.potential_guesses) {
            // Assuming we use this word as our guess, determine how the potential solutions will be grouped based on the obtained info.
            // For each potential solution, get the result string that would result from trying it, and count how many of each string in each group.
            let solution_group_counts = new Map()
            for (const pot_sol of this.potential_solutions) {
                let res_str = this._fast_word_result(word, pot_sol)
                solution_group_counts[res_str] = (solution_group_counts[res_str] || 0) + 1
            }
            // We want to optimize for smallest average expected group size.
            // The probability of the solution being in a given group is dependent on the group's size, so
            // the average expected group size is the weighted average of group sizes, weighted by group size.
            let word_score = Object.values(solution_group_counts).reduce((sum, s) => sum + s * s, 0) /
              Object.values(solution_group_counts).reduce((sum, s) => sum + s, 0)
            // Add a small boost if this word is one of the possible solutions
            if (this.potential_solutions.has(word)) {
                word_score -= .01
            }
            // Update best_words
            binary_insertion(best_words, [word, word_score])
            if (best_words.length > 10) best_words.pop()
        }
        return best_words
    }

    static get_word_result(guess, target) {
        // Returns the result string generated by comparing a guessed word to the correct target word.
        let r_list = new Array(target.length).fill("X")
        let target_l_counts = WordleSolver._get_letter_counts(target, true)
        for (let i = 0; i < target.length; i++) {
            if (guess[i] === target[i]) {
                r_list[i] = "C"
                target_l_counts[target[i]] -= 1
            }
        }
        for (let i = 0; i < target.length; i++) {
            if (guess[i] !== target[i] && target_l_counts[guess[i]] > 0) {
                r_list[i] = "L"
                target_l_counts[guess[i]] -= 1
            }
        }
        return r_list.join("")
    }

    run_auto(target_word) {
        /// Runs the game trying to guess a given target word.  Returns the number of guesses required.
        this.reset()
        let n_guesses = 0
        while (true) {
            n_guesses += 1
            let guesses = this.get_guess()
            let guess = guesses[0][0]
            if (guess === target_word) break
            let res = WordleSolver.get_word_result(guess, target_word)
            // console.log(`Guess: ${guess} Res: ${res}`)
            this.update(guess, res)
        }
        return n_guesses
    }
}

let solver = undefined
let curr_evals = 0

function getItem(key) {
    return JSON.parse(window.localStorage.getItem('nyt-wordle-state'))[key]
}

browser.runtime.onMessage.addListener( (request, sender, sendResponse) => {
    try {
        getInput().then(sendResponse)
        return true
    } catch (e) {
        console.error("encountered JSON parse error", e);
    }
});

async function getInput() {
    if (solver === undefined) {
        solver = await WordleSolver.create(getItem("hardMode"))
    }
    let evaluations = getItem("evaluations")
    let board_state = getItem("boardState")
    for (let i = curr_evals; i < 6; i++) {
        if (board_state[i] === "") {
            curr_evals = i
            break
        }
        solver.update(board_state[i], evaluations[i])
    }
    return solver.get_guess();
}