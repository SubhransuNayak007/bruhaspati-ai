// === checkTokenLimit ===
function checkTokenLimit(cost) {
  let limit = getPlanLimit();
  if (tokenState.tokensUsed + cost > limit) {
    openUpgradeModal();
    showToast("⚠️ Daily limit reached. Please upgrade or configure Pro keys.");
    return false;
  }
  return true;
}

// === consumeTokens ===
function consumeTokens(cost) {
  tokenState.tokensUsed += cost;
  saveTokenState();
  updateTokenMeterUI();
}

// === estimateRequestCost ===
function estimateRequestCost(query) {
  if (detectQuizQuery(query)) return 150;
  if (detectFormulaQuery(query)) return 200;
  if (detectPYQQuery(query)) return 200;
  if (uploadedFiles && uploadedFiles.length > 0) return 300;
  return 100;
}

