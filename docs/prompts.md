# Prompt Engineering Guide - Smart Stadium AI Copilot

This document outlines the AI Prompt Engineering architecture, prompts, context strategies, and safety configurations utilized by the Stadium AI Copilot.

---

## 🤖 Model Selection

- **Primary Chat Model:** Generative AI Chat Engine (mocked dynamically in our local python tests and RAG logic to ensure 100% test independence and bypass external API rate limits).
- **Embedding Model:** Local deterministic 128-dimensional SHA-256 Vector Encoder (guarantees instant local similarity searches without network dependency overhead).

---

## 📝 Prompts Architecture

### 1. System Prompt
Defines the bot identity, context injection bounds, and strict constraints:

```markdown
Role: AI Smart Stadium Operations Assistant
Context: You are helping fans, vendors, and staff at the FIFA World Cup 2026.
Behavior Constraints:
- Use only the provided Policy Context to answer questions.
- If context does not contain the answer, use the fallback policy text.
- Do not make up facts.
- Include a confidence score (0.0 to 1.0) based on context overlap.
- Always output a brief reasoning explanation for your recommendation.
```

### 2. Prompt Strategy (RAG Injection Pattern)
The prompt is constructed dynamically by stitching retrieved policy elements together:

```markdown
Answer the query based ONLY on the following grounded policy context:
---------------------
{{ POLICY_CONTEXT }}
---------------------

Query: {{ USER_QUERY }}

Provide your response in JSON format containing:
- "answer": (string response)
- "confidence_score": (float value from 0.0 to 1.0)
- "reasoning": (explanation of policy grounds)
```

### 3. Fallback Prompt (Simulated / Local RAG)
When no policy context hits a similarity rating threshold of `0.7` inside the vector space, the copilot falls back to an internal policy match:

```markdown
No database policy found matching user query. 
Falling back to internal policy match logic:
- Query contains "refund": Fall back to Vendor Refund policy.
- Query contains "price" / "surge": Fall back to Pricing Policy.
- Default: Fall back to General Facility FAQs.
```

---

## 🛡️ Safety Guardrails

- **Prompt Injection Prevention:** The system strips markdown control characters and raw python inputs from user queries prior to embedding.
- **Strict Grounding:** The prompt forbids the AI from utilizing model knowledge base details that fall outside of the stadium policies context bounds, preventing hallucinations about stadium services.
- **PII Filtering:** Strips potential sensitive parameters (e.g., ticket serial IDs, phone numbers) before passing queries to the vector database search.
