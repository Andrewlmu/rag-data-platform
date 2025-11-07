# GPT-5 Integration Diagnostic Report
**Date:** 2025-01-06  
**System:** PE Analysis RAG Platform  

---

## 🔍 Executive Summary

**DIAGNOSIS:** GPT-5 is **FULLY AVAILABLE** but **INCOMPATIBLE** with current LangChain setup.

**ROOT CAUSE:** Parameter mismatch - GPT-5 requires `max_completion_tokens` instead of `max_tokens`.

**STATUS:** ✅ GPT-5 works with raw OpenAI SDK | ❌ GPT-5 fails with LangChain ChatOpenAI

---

## 📊 Test Results

### Test 1: GPT-5 with Raw OpenAI SDK ✅
```typescript
const response = await client.chat.completions.create({
  model: 'gpt-5',
  max_completion_tokens: 20,  // ← Required parameter
  temperature: 1,
  messages: [...]
});
```
**Result:** ✅ SUCCESS - GPT-5 is working!  
**Model:** gpt-5-2025-08-07  
**Usage:** 16 prompt tokens, 20 completion tokens (20 reasoning tokens)

### Test 2: GPT-5 with LangChain ChatOpenAI ❌
```typescript
const llm = new ChatOpenAI({
  modelName: 'gpt-5',
  maxTokens: 50,  // ← LangChain uses this parameter
  temperature: 1
});
```
**Result:** ❌ FAILED  
**Error:** "400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."

### Test 3: GPT-4-turbo with LangChain ✅
**Result:** ✅ SUCCESS (currently working)  
**Model:** gpt-4-turbo-2024-04-09

### Test 4: GPT-4o with Raw SDK ✅
**Result:** ✅ SUCCESS  
**Model:** gpt-4o-2024-08-06

---

## 🔎 Available GPT-5 Models

Our API key has access to **all GPT-5 variants**:

| Model | Description | Use Case |
|-------|-------------|----------|
| `gpt-5` | Latest GPT-5 | Production (cheapest option) |
| `gpt-5-2025-08-07` | Dated version | Stability |
| `gpt-5-mini` | Mid-tier | Balanced cost/performance |
| `gpt-5-mini-2025-08-07` | Dated mini | Stability |
| `gpt-5-nano` | Cheapest | High-volume tasks |
| `gpt-5-nano-2025-08-07` | Dated nano | Stability |
| `gpt-5-pro` | Most capable | Complex reasoning |
| `gpt-5-pro-2025-10-06` | Dated pro | Stability |

**Recommendation:** Use `gpt-5` or `gpt-5-nano` for cost savings.

---

## 🐛 The Problem

### Current Package Versions
- `@langchain/openai`: 0.0.12  
- `openai`: 4.104.0  
- LangChain Core: 0.1.63

### LangChain Issue
LangChain's `ChatOpenAI` class converts `maxTokens` → `max_tokens` in API calls, but GPT-5 (reasoning model) requires `max_completion_tokens`.

### GitHub Issues Found
1. [Issue #32949](https://github.com/langchain-ai/langchain/issues/32949) - Adding GPT-5 max_completion_tokens support
2. [Issue #29954](https://github.com/langchain-ai/langchain/issues/29954) - Compatibility between max_tokens and max_completion_tokens
3. [Issue #8039](https://github.com/langchain-ai/langchainjs/issues/8039) - max_completion_tokens required for o4-mini (similar issue)

**Status:** Being actively fixed in LangChain repo (as of 2025)

---

## 💡 Solution Options

### Option 1: Wait for LangChain Update (RECOMMENDED FOR PRODUCTION)
**Pros:**
- Official support
- Future-proof
- No code workarounds

**Cons:**
- Unknown timeline
- Currently blocking

**Action:** Monitor `@langchain/openai` releases for GPT-5 support

---

### Option 2: Use GPT-4o (QUICK WIN)
**Pros:**
- Works immediately with current codebase
- Latest GPT-4 model (released Nov 2024)
- Compatible with LangChain
- Still significantly better than gpt-4-turbo

**Cons:**
- Not GPT-5 (but close performance)
- Slightly more expensive than GPT-5

**Action:** Change `.env` to `LLM_MODEL=gpt-4o`

**Cost Comparison:**
- GPT-4-turbo: Most expensive
- GPT-4o: Mid-range
- GPT-5: Cheaper than GPT-4o
- GPT-5-nano: Cheapest option

---

### Option 3: Create Custom LangChain Wrapper (COMPLEX)
**Pros:**
- Immediate GPT-5 access
- Full control

**Cons:**
- Maintenance burden
- May break with LangChain updates
- Complex implementation with streaming/tool calling

**Action:** Create custom `ChatGPT5` class extending `ChatOpenAI`

**Code Required:**
- Override `_llmType()` method
- Override API call to use `max_completion_tokens`
- Handle streaming responses
- Handle tool calling for agentic RAG

**Estimated Effort:** 4-6 hours + testing

---

### Option 4: Bypass LangChain for GPT-5 (HYBRID APPROACH)
**Pros:**
- Use GPT-5 where possible
- Keep LangChain for non-LLM features

**Cons:**
- Code duplication
- Inconsistent architecture
- Complex error handling

---

## 🎯 Recommendation

**SHORT-TERM (Immediate):** Switch to `gpt-4o`
```bash
# In .env file
LLM_MODEL=gpt-4o
```
- No code changes needed
- Works with current LangChain setup
- Better than current gpt-4-turbo
- Production-ready

**MID-TERM (1-2 weeks):** Monitor LangChain updates
```bash
npm outdated @langchain/openai
```

**LONG-TERM (When LangChain adds support):** Switch to GPT-5
```bash
LLM_MODEL=gpt-5  # or gpt-5-nano for cost savings
```

---

## 📝 Files Requiring Changes (When LangChain Ready)

1. **src/services/queryEngine.ts:54**
   - Change `maxTokens` → `maxCompletionTokens`
   
2. **src/agents/react-agent.ts:44**
   - Update agent LLM config
   
3. **src/config/agent.config.ts:32**
   - Update config interface

4. **src/types/agent.types.ts:106**
   - Update type definition

**NO CHANGES NEEDED IF USING GPT-4O** - current code works as-is.

---

## 💰 Cost Analysis

Based on OpenAI pricing (estimated):

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Use Case |
|-------|---------------------|----------------------|----------|
| gpt-4-turbo | $10.00 | $30.00 | Current (expensive) |
| gpt-4o | $2.50 | $10.00 | **Recommended now** |
| gpt-5 | $2.00 | $8.00 | Future (when supported) |
| gpt-5-nano | $0.50 | $2.00 | Future (high volume) |

**Savings by switching from gpt-4-turbo to gpt-4o:** ~75% cost reduction  
**Additional savings with gpt-5-nano:** ~95% total cost reduction vs current

---

## ✅ Action Items

- [x] Diagnose GPT-5 availability
- [x] Test raw OpenAI SDK
- [x] Identify LangChain incompatibility
- [x] Research LangChain GitHub issues
- [ ] **DECISION NEEDED:** Choose immediate path (gpt-4o vs wait)
- [ ] Update .env with chosen model
- [ ] Test with real queries
- [ ] Monitor LangChain for GPT-5 support
- [ ] Switch to GPT-5 when LangChain ready

---

## 🔗 References

- OpenAI GPT-5 Models: All variants available
- LangChain Issue #32949: GPT-5 support tracking
- OpenAI API: max_completion_tokens required for reasoning models
- Current Stack: LangChain 0.0.12, OpenAI SDK 4.104.0

---

**Report Generated:** 2025-01-06  
**Next Review:** Check LangChain updates weekly
