/**
 * history-data.js — Galileo Lab Stage 5 content
 * Teacher-editable. No logic here — only data.
 */

const HistoryData = {
  sections: [
    {
      tag:'THE MYTH', tagColor:'var(--gold,#ffd166)', heading:'The Story Everyone Knows',
      prose:`<p>Around 1590, so the story goes, Galileo Galilei climbed to the top of the Leaning Tower of Pisa, held out a cannonball and a musket ball, and dropped them simultaneously. The heavy ball and the light ball — according to Aristotle — should land at very different times. The crowd below watched. Both hit the ground together. Aristotle was wrong. The end.</p><p>It is a great story. Dramatic setting, clear result, heroic scientist proving the establishment wrong in front of witnesses.</p>`,
      figure:'tower', hasCanvas:true, prompt:'Select all the statements you agree with.',
      pool:{
        misconceptions:[
          {id:'S0_M0',text:'Heavier objects always fall faster — mass alone determines fall speed.',explanation:'Mass alone does not determine fall speed in air. The flat paper and the crumpled ball have the same mass but fall at different speeds. What changed was the shape — and therefore the air resistance.'},
          {id:'S0_M1',text:'Shape does not affect how fast something falls — only mass counts.',explanation:'The mini drop showed otherwise. Flat paper and crumpled paper have identical mass. The crumpled ball fell faster because its smaller surface area produced less air resistance. Shape matters.'},
          {id:'S0_M2',text:'Air resistance only affects light objects — not things like crumpled paper.',explanation:'Air resistance acts on all objects. Even the crumpled paper — small and relatively compact — experienced less drag than the flat sheet, and fell noticeably faster as a result.'},
          {id:'S0_M3',text:'The Tower of Pisa story must be true — the conclusion has been proven correct.',explanation:'A conclusion being correct does not mean the story that supports it is accurate. In air, a cannonball and a musket ball do not land at exactly the same time — air resistance creates a small difference. The story as told is physically misleading, even if Galileo\'s broader insight was right.'},
          {id:'S0_M4',text:'As long as the result is correct, it does not matter how the experiment was done.',explanation:'Method matters enormously. An experiment done poorly can produce the right answer by accident — and give the wrong answer in other situations. Galileo\'s strength was not his conclusion but his method: controlled, repeatable, measurable.'},
          {id:'S0_M5',text:'An iron ball and a feather dropped from a tall building would land at the same time.',explanation:'Only in a vacuum. In air, the feather experiences far more drag relative to its weight and reaches a very low terminal velocity. The iron ball, with its much higher weight-to-drag ratio, falls far faster. They land together only when air is removed — as astronaut David Scott demonstrated on the Moon in 1971.'},
        ],
        correct:[
          {id:'S0_C0',text:'In air, shape affects fall speed.',explanation:'Correct. The mini drop demonstrated this directly — flat paper and crumpled paper have the same mass, but the flat sheet fell much more slowly because its large surface area produced greater air resistance.'},
          {id:'S0_C1',text:'The Tower of Pisa story may not be accurate — a single drop in air cannot cleanly prove that all objects fall at the same rate.',explanation:'Correct. The story first appeared in a biography written decades after Galileo\'s death by a student known to embellish. More importantly, dropping objects in air introduces air resistance — making the result messy and hard to interpret cleanly.'},
          {id:'S0_C2',text:'Air resistance depends on shape and surface area, not just how heavy something is.',explanation:'Correct. The drag force on an object is F = ½ρCdAv², where A is the cross-sectional area and Cd is the drag coefficient — neither of which involves mass. Two objects with the same mass but different shapes experience very different drag forces.'},
          {id:'S0_C3',text:'In air, a heavier object of the same shape falls faster than a lighter one.',explanation:'Correct. When shape is held constant, a heavier object has a higher terminal velocity — the speed at which drag equals weight. A lead ball and a hollow plastic ball of the same size will fall at different speeds in air because the lead ball is heavier and therefore reaches a higher terminal velocity before drag balances gravity.'},
        ],
      },
      draw:{misconceptions:3,correct:2},
    },
    {
      tag:'THE REALITY', tagColor:'var(--accent,#4df0b0)', heading:'What Galileo Actually Did',
      prose:`<p>There is no reliable historical record of the Tower drop ever happening. The story first appeared decades after Galileo's death, written by his student Vincenzo Viviani — who was known to embellish.</p><p>What Galileo <em>did</em> do, documented in his own notebooks, was far more careful — and far more powerful. He built a long, smooth ramp. He varied the length. He timed the rolls using a water clock. He recorded the numbers. He noticed that the time depended on the length of the ramp, not on the mass of the ball.</p><p>By controlling one variable at a time, he could separate the effect of gravity from the effect of air resistance — something a single dramatic drop from a tower could never cleanly do.</p>`,
      figure:'ramp', hasCanvas:false, prompt:'Select all the statements you agree with.',
      pool:{
        misconceptions:[
          {id:'S1_M0',text:'The heavier ball should reach the bottom of the ramp first.',explanation:'On a frictionless ramp, both balls experience the same acceleration — g sinθ — regardless of mass. Mass cancels out of the equations of motion. The ramp experiment confirmed this: both balls landed at the same time.'},
          {id:'S1_M1',text:'Increasing the mass of the ball would decrease the time it takes to reach the bottom of the ramp.',explanation:'Mass has no effect on ramp time. The acceleration along a frictionless ramp is g sinθ, which contains no mass term. Doubling the mass doubles both the driving force (mg sinθ) and the inertia — they cancel exactly. Time depends only on ramp length and angle.'},
          {id:'S1_M2',text:'One well-designed experiment is enough to establish a scientific result.',explanation:'A single experiment, however well-designed, can be affected by measurement error, random variation, or uncontrolled variables. Scientific results require repeated trials to establish reliability. Galileo rolled balls down his ramp many times, not once.'},
          {id:'S1_M3',text:'The ramp result only applies to ramps — it tells us nothing about free fall.',explanation:'Galileo used the ramp precisely because it slows motion enough to measure. The physics is the same — gravity acting on a mass. By varying the angle, he could extrapolate towards free fall (90°). The ramp is a controlled window into the same phenomenon.'},
          {id:'S1_M4',text:'Recording exact times is unnecessary — you can tell which ball wins just by watching.',explanation:'Visual observation is unreliable for small differences. In the ramp experiment, both balls land at almost the same time — the eye cannot distinguish a 10ms difference. Precise timing revealed that mass makes no difference at all. Without measurement, this conclusion is impossible to reach confidently.'},
          {id:'S1_M5',text:'An approximate time is good enough — small differences in measurement do not affect the conclusion.',explanation:'Measurement precision directly affects the quality of conclusions. In the ramp experiment, the relationship t² ∝ L only emerges clearly from accurate timing. Imprecise measurements introduce scatter that can obscure or distort the pattern entirely.'},
          {id:'S1_M6',text:'Both balls reach the bottom at the same time on a smooth ramp, but the heavier ball reaches the bottom faster if the ramp is rough.',explanation:'Even on a rough ramp, both balls still reach the bottom at the same time. The friction force on each ball is μmg cosθ, and the driving force is mg sinθ. Mass (m) appears in both terms and cancels out — just as it does on a smooth ramp. The result is independent of mass whether the surface is smooth or rough.'},
        ],
        correct:[
          {id:'S1_C0',text:'Both balls reached the bottom at the same time — mass did not affect the result.',explanation:'Correct. On a frictionless ramp, acceleration = g sinθ for all masses. The experiment confirmed this directly — heavy and light balls landed simultaneously across all ramp lengths tested.'},
          {id:'S1_C1',text:'Galileo controlled one variable at a time, exactly as we varied only L while keeping the angle fixed.',explanation:'Correct. This is the core of controlled experimentation. By fixing the angle and varying only the length, Galileo (and you) could isolate the effect of length on time — and discover the t² ∝ L relationship cleanly.'},
          {id:'S1_C2',text:'Repeated careful measurement is more reliable than visual observation alone.',explanation:'Correct. Repeated measurement allows you to identify random error, calculate averages, and assess consistency. Visual observation has no such checks — it is subject to reaction time, expectation bias, and the limits of human perception.'},
          {id:'S1_C3',text:'The ramp slows the motion enough to measure accurately — the same principle applies to free fall.',explanation:'Correct. At 30°, the acceleration along the ramp is g sin30° = 4.9 m/s² — about half of free fall. This made timing tractable. The physics governing the motion is identical; only the rate differs.'},
        ],
      },
      draw:{misconceptions:3,correct:2},
    },
    {
      tag:'THE INSIGHT', tagColor:'var(--purple,#c77dff)', heading:'What This Means',
      prose:`<p>The Tower story is satisfying because it is simple: one drop, one answer. But simplicity can mislead. In air, a feather and a ball <em>don't</em> land together — you saw that yourself. A single dramatic demonstration would have proved nothing reliable.</p><p>Galileo's genius was not the spectacle. It was the method: isolate one variable, repeat the measurement, look for a pattern in the numbers. That is still how physics — and all of science — works today.</p><p>When you placed the paper on the book and they fell together, you were not just watching a trick. You were isolating air resistance the same way Galileo isolated mass on his ramp. The method is 400 years old. You just used it.</p>`,
      figure:'method', hasCanvas:false, prompt:'Select all the statements you agree with.',
      pool:{
        misconceptions:[
          {id:'S2_M0',text:'A dramatic public demonstration is more convincing than repeated careful measurements.',explanation:'A dramatic demonstration may be persuasive, but persuasion is not the same as evidence. A single public drop cannot account for air resistance, reaction time, or measurement error. Repeated careful measurements with controlled variables produce results that can be verified, challenged, and built upon.'},
          {id:'S2_M1',text:'Air resistance only matters for very light or fluffy objects.',explanation:'Air resistance acts on all objects moving through air. It matters more when the drag force is large relative to the object\'s weight — which is why a feather is affected more than a cannonball. But even heavy objects are affected: a skydiver in freefall reaches a terminal velocity well below the speed they would reach without air.'},
          {id:'S2_M2',text:'The paper landed with the book because the book physically pushed it downward.',explanation:'The book did not push the paper. The paper rested on top of the book\'s face, shielded from the oncoming air. Without air resistance acting on it, the paper fell at the same rate as the book — exactly as Galileo\'s ramp showed that mass does not determine fall rate when resistance is removed.'},
          {id:'S2_M3',text:'Galileo\'s method and the ramp experiment we did are fundamentally different things.',explanation:'They are the same method. Fix one variable (angle), vary another (length), measure the result (time), repeat, look for a pattern. Galileo did this in the 1600s with a water clock. You did it with a digital timer. The tools differ — the method is identical.'},
          {id:'S2_M4',text:'Once you understand a concept, repeating the experiment adds no value.',explanation:'Repetition serves multiple purposes beyond initial understanding: it checks for consistency, reduces the effect of random error, tests whether results hold under slightly different conditions, and builds the body of evidence needed to support a scientific claim.'},
          {id:'S2_M5a',text:'The crumpled paper fell faster because it is more compact and therefore heavier.',explanation:'The crumpled paper and the flat paper have identical mass — the same sheet was simply reshaped. Compactness does not change mass. What changed was the surface area exposed to air, which reduced drag. The crumpled ball fell faster because of less air resistance, not because of greater weight.'},
          {id:'S2_M5b',text:'The crumpled paper fell faster because crumpling increases its density, and denser objects fall faster.',explanation:'Crumpling does increase density (same mass, smaller volume), but density alone does not determine fall speed in air. What matters is the ratio of weight to drag force. The crumpled paper fell faster because its smaller surface area reduced air resistance — not because its density increased.'},
        ],
        correct:[
          {id:'S2_C0',text:'Sheltering the paper from air resistance made it fall at the same rate as the book.',explanation:'Correct. With air resistance removed by the shelter of the book, the only force acting on the paper was gravity. Under gravity alone, all objects accelerate equally — just as Galileo\'s ramp showed. The paper and book fell together because the confounding variable (air resistance) was eliminated.'},
          {id:'S2_C1',text:'Isolating one variable at a time is what makes an experiment\'s result trustworthy.',explanation:'Correct. If multiple variables change at once, you cannot tell which one caused the observed result. By changing only one thing at a time — length, then mass, then surface area — each experiment produces a clean, interpretable result.'},
          {id:'S2_C2',text:'The same scientific method Galileo used 400 years ago is still how physics works today.',explanation:'Correct. Controlled experimentation, repeated measurement, and pattern-finding in data are the foundation of modern science. The tools have changed — computers, lasers, particle accelerators — but the underlying method is the same one Galileo developed on his ramp.'},
          {id:'S2_C3',text:'Two objects with the same mass can fall at very different speeds in air, depending on their shape.',explanation:'Correct. The flat and crumpled paper demonstrated this directly. Same mass, same gravitational force — but very different speeds because shape determines the drag force. In air, shape can matter as much as mass.'},
        ],
      },
      draw:{misconceptions:3,correct:2},
    },
  ],

  pinnedOptions:[
    {id:'ADD_THOUGHTS',text:'I have additional thoughts…',type:'freetext_optional',placeholder:'Share any additional observations or ideas…'},
    {id:'NONE',text:'None of the above.',type:'none',placeholder:'None of the statements match your thinking — describe what you believe is happening…'},
  ],

  ui:{
    watchDropBtn:'▶ Watch the drop', replayBtn:'↺ Replay',
    submitBtn:'Submit →', continueBtn:'Continue →', completeBtn:'Complete the Lab ✓',
    submitLockHint:'Select at least one option to continue.',
    noneMinChars:10, revealDelayMs:120, countdownFrom:3,
  },

  completion:{icon:'🔬',title:'Lab Complete',message:'You observed, you measured, you found the pattern.\nFour hundred years later — the method still works.'},

  footnote:`Historical note: The Tower of Pisa story originates from Viviani's <em>Life of Galileo</em> (c.&thinsp;1654), written approximately 12 years after Galileo's death. Galileo's inclined plane experiments are documented in his own <em>Discourses and Mathematical Demonstrations Relating to Two New Sciences</em> (1638).`,
};

if(typeof module!=='undefined') module.exports=HistoryData;
