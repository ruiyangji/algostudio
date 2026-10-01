/**
 * AlgoStudio Client Bootstrap
 */

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSplitter();
  initEditor();
  await loadQuestionsIndex();

  const hashQid = getHashParam('q');
  if (hashQid) {
    await loadQuestionById(hashQid);
  } else if (state.questionsIndex && state.questionsIndex.length > 0) {
    await loadQuestionById(state.questionsIndex[0].id);
  }
});
