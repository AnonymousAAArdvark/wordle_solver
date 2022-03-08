let guess
async function updateGuesses() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab.url === "https://www.nytimes.com/games/wordle/index.html") {
    await chrome.tabs.sendMessage(tab.id, {}, (resp) => {
      guess = resp
      const guesses_elem = document.getElementById("guesses")
      guesses_elem.innerHTML = ""
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
    })
  }
}
// Run when the popup is clicked
document.addEventListener('DOMContentLoaded', async () =>
  await updateGuesses()
)

async function injectTheScript() {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    chrome.scripting.executeScript({target: {tabId: tabs[0].id}, func: sim_input, args: [this.id]})
  })
  await updateGuesses()
}

function sim_input(guess) {
  const key_map = {
    q:[1,1],w:[1,2],e:[1,3],r:[1,4],t:[1,5],y:[1,6],u:[1,7],i:[1,8],o:[1,9],p:[1,10],
    a:[2,2],s:[2,3],d:[2,4],f:[2,5],g:[2,6],h:[2,7],j:[2,8],k:[2,9],l:[2,10],
    z:[3,2],x:[3,3],c:[3,4],v:[3,5],b:[3,6],n:[3,7],m:[3,8],
    enter:[3,1]
  }
  for (let i = 0; i < 6; i++) {
    let k = ''
    if (i >= 5) {
      k = 'enter'
    } else {
      k = guess[i]
    }
    document.querySelector("body > game-app").shadowRoot.querySelector("#game > game-keyboard").shadowRoot.querySelector(`#keyboard > div:nth-child(${key_map[k][0]}) > button:nth-child(${key_map[k][1]})`).click()
  }
}