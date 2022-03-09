chrome.runtime.onMessage.addListener(sim_input);
function sim_input(message){
  guess = message.guess;
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
  chrome.runtime.onMessage.removeListener(message);  //optional
}