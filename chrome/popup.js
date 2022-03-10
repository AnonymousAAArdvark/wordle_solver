async function updateGuesses() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const guesses_elem = document.getElementById("guesses")
  if (tab.url === "https://www.nytimes.com/games/wordle/index.html") {
    await chrome.tabs.sendMessage(tab.id, {}, (resp) => {
      guesses_elem.innerHTML = ""
      if (resp.length === 0) {
        const msg_elem = document.createElement("p")
        msg_elem.classList.add("message")
        msg_elem.innerHTML = "There are no other possible guesses."
        guesses_elem.appendChild(msg_elem)
      } else {
        for (const guess of resp) {
          const row_elem = document.createElement("div")
          row_elem.classList.add("row")
          row_elem.id = guess[0]
          row_elem.addEventListener("click", injectTheScript)
          const guess_elem = document.createElement("div")
          guess_elem.classList.add("guess")
          for (const letter of guess[0]) {
            const tile_elem = document.createElement("div")
            tile_elem.classList.add("tile")
            tile_elem.innerHTML = letter.toUpperCase()
            guess_elem.appendChild(tile_elem)
          }
          const score_elem = document.createElement("div")
          score_elem.classList.add("score")
          score_elem.innerHTML = (Math.round(guess[1] * 100) / 100).toString()
          row_elem.appendChild(guess_elem)
          row_elem.appendChild(score_elem)
          guesses_elem.appendChild(row_elem)
        }
      }
    })
  } else {
    const link_elem = document.createElement("a")
    link_elem.classList.add("message")
    link_elem.href = "https://www.nytimes.com/games/wordle/index.html"
    link_elem.target = "blank"
    link_elem.innerHTML = "Open today's Wordle"
    guesses_elem.appendChild(link_elem)
  }
}
// Run when the popup is clicked
document.addEventListener('DOMContentLoaded', async () => {
  await updateGuesses()
  }
)

async function injectTheScript() {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    // browser.tabs.executeScript({target: {tabId: tabs[0].id}, func: sim_input, args: [this.id]})
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      files: ["util/sim_input.js"],
    }, _ => {
      chrome.tabs.sendMessage(tabs[0].id, { guess: this.id })
      updateGuesses()
    })
  })
}
