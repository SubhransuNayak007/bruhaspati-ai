// === sendMessage ===
function sendMessage() {
  const input = document.getElementById('userInput');
  const query = input.value.trim();
  if (!query || state.isTyping) return;
  
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  // Token Limit Validation
  let cost = estimateRequestCost(query);
  if (!checkTokenLimit(cost)) return;

  // Hide Welcome Screen
  document.getElementById('welcomeScreen').style.display = 'none';

  // Append user bubble
  const hasAttachment = uploadedFiles.length > 0;
  state.messages.push({
    sender: 'user',
    text: query,
    hasAttachment: hasAttachment,
    timestamp: Date.now()
  });
  
  const area = document.getElementById('messagesArea');
  const div = document.createElement('div');
  div.className = 'msg-user';
  let badgeHtml = hasAttachment ? `<span class="attachment-badge" style="font-size:9.5px; opacity:0.6; margin-right:4px;">📎 Notes attached</span>` : '';
  div.innerHTML = `
    <div class="msg-user-bubble">
      ${badgeHtml}${escapeHtml(query)}
      <span class="msg-timestamp">${formatTime(Date.now())}</span>
    </div>
  `;
  area.appendChild(div);
  
  input.value = '';
  autoResize(input);
  scrollToBottom();
  
  // Show streaming bubble placeholder
  const streamCardId = 'resp_' + Date.now();
  const aiBubbleDiv = document.createElement('div');
  aiBubbleDiv.className = 'msg-ai';
  aiBubbleDiv.innerHTML = `
    <div class="ai-avatar"><img src="logo.jpg" alt="Bruhaspati AI"></div>
    <div class="ai-content">
      <div class="response-card skeleton-card" id="${streamCardId}">
        <div class="skeleton-line" style="width: 40%"></div>
        <div class="skeleton-line" style="width: 90%"></div>
        <div class="skeleton-line" style="width: 75%"></div>
        <div class="skeleton-line" style="width: 60%"></div>
      </div>
      <span class="msg-timestamp">${formatTime(Date.now())}</span>
    </div>
  `;
  area.appendChild(aiBubbleDiv);
  scrollToBottom();
  
  state.isTyping = true;
  document.getElementById('sendBtn').disabled = true;
  
  // Stream response call
  await streamAIResponse(query, streamCardId);
  
  // Clear local upload previews
  uploadedFiles = [];
  renderUploadPreviews();
  
  // Deduct tokens
  consumeTokens(cost);
  
  state.isTyping = false;
  document.getElementById('sendBtn').disabled = false;
}

// === retryMessage ===


// === clearChat ===


