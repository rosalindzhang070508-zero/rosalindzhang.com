const tasks = [...document.querySelectorAll('input[data-task]')];
const storageKey = 'rosalindzhang-checklist-v1';

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    tasks.forEach(t => t.checked = !!saved[t.dataset.task]);
  } catch {}
  updateProgress();
}
function saveTasks() {
  const saved = {};
  tasks.forEach(t => saved[t.dataset.task] = t.checked);
  localStorage.setItem(storageKey, JSON.stringify(saved));
  updateProgress();
}
function updateProgress() {
  const done = tasks.filter(t => t.checked).length;
  document.getElementById('progressText').textContent = `${done} / ${tasks.length} completed`;
}
tasks.forEach(t => t.addEventListener('change', saveTasks));
document.getElementById('clearDone').addEventListener('click', () => {
  tasks.forEach(t => t.checked = false);
  saveTasks();
});
document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('today').textContent = new Intl.DateTimeFormat('en-US', {
  day:'2-digit', month:'short', year:'numeric'
}).format(new Date());
loadTasks();
