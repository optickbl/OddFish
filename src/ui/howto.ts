import { GAME, TIERS } from '../config';
import { ICON, tierArt } from './art';
import { sheet } from './dom';

export function showHowTo(onClose?: () => void) {
  const strip = TIERS.map((t) => `<div>${tierArt(t.id)}<b>${t.kg} kg</b>${t.rarity}</div>`).join('');
  const { root, close } = sheet(
    `<button class="icon-btn close" data-close aria-label="Close">${ICON.close}</button>
     <h2>How to play</h2>
     <ol class="steps">
       <li><div class="ico">${ICON.fish}</div><div><b>Name something that fits</b><span>${GAME.questionsPerCast} prompts a day, ${GAME.secondsPerQuestion} seconds each. Any correct answer counts.</span></div></li>
       <li><div class="ico">${ICON.diamond}</div><div><b>Rare answers catch rare fish</b><span>The fewer players who give your answer, the bigger your catch.</span></div></li>
       <li><div class="ico">${ICON.anchor}</div><div><b>One Captain’s Wager a day</b><span>Double the weight of one catch. A wrong answer wastes it.</span></div></li>
       <li><div class="ico">${ICON.hook}</div><div><b>Pick your bait</b><span>Before you cast, choose a topic. Its catches weigh double.</span></div></li>
       <li><div class="ico">${ICON.wave}</div><div><b>Catch the Surprise Tide</b><span>A secret 90-minute window each day when everything weighs double.</span></div></li>
       <li><div class="ico">${ICON.star}</div><div><b>Shiny, Night and Mutant fish</b><span>A rare golden roll, a correct answer inside 5 seconds, or casting after dark.</span></div></li>
       <li><div class="ico">${ICON.boat}</div><div><b>Spend your haul in the Harbour</b><span>Upgrade the boat, buy streak freezes, bet on your streak, and read the Captain’s Log.</span></div></li>
     </ol>
     <div class="tierstrip">${strip}</div>
     <p class="note" style="margin-top:14px">Rarity is estimated until enough players have answered a question, and always says which.</p>
     <button class="btn primary wide" data-close autofocus style="margin-top:22px">Got it</button>`,
    { label: 'How to play', onClose },
  );
  return { root, close };
}
