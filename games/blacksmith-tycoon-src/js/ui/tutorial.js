/* =====================================================================
   Tutorial — ป๊อปอัพสอนเล่นครั้งแรก (ดู TUTORIAL_STEPS ใน data.js)
   โชว์อัตโนมัติครั้งแรก (tutorialSeen=false) เปิดซ้ำได้จากตั้งค่า
   ===================================================================== */
let tutorialStep = 0;

function renderTutorialStep() {
  const s = TUTORIAL_STEPS[tutorialStep];
  document.getElementById('tutorialIcon').textContent = s.icon;
  document.getElementById('tutorialTitle').textContent = s.title;
  document.getElementById('tutorialBody').textContent = s.body;
  const dots = document.getElementById('tutorialDots');
  dots.innerHTML = '';
  TUTORIAL_STEPS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'tutorial-dot' + (i === tutorialStep ? ' active' : '');
    dots.appendChild(dot);
  });
  document.getElementById('btnTutorialNext').textContent =
    tutorialStep === TUTORIAL_STEPS.length - 1 ? 'เริ่มเล่นเลย!' : 'ต่อไป';
}

function openTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
  document.getElementById('tutorialModal').classList.add('show');
}

function closeTutorial() {
  document.getElementById('tutorialModal').classList.remove('show');
  if (!player.tutorialSeen) { player.tutorialSeen = true; saveGame(); }
}

document.getElementById('btnTutorialNext').addEventListener('click', () => {
  if (tutorialStep < TUTORIAL_STEPS.length - 1) {
    tutorialStep++;
    renderTutorialStep();
  } else {
    closeTutorial();
  }
});

// โชว์ครั้งแรกอัตโนมัติ (เรียกจาก main.js's bootstrap) — ผู้เล่นใหม่ที่ยังไม่เคยดู
function maybeShowTutorial() {
  if (!player.tutorialSeen) openTutorial();
}
