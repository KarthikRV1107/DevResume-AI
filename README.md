# 🚀 DevResume AI  
### Context Recovery Engine for Developers  

> You didn’t lose your skill. You lost your context.

---

## 📌 Theme
**AI Super Productivity – Focus & Flow**

---

## 🧠 Problem Statement

Developers frequently switch between tasks, meetings, debugging sessions, and multiple repositories.  
When returning to unfinished code, they often spend 20–40 minutes rebuilding mental context:

- What was I building?
- What is incomplete?
- What logic is missing?
- What should I do next?

This context-switching overhead significantly reduces productivity and development velocity.

---

## 💡 Solution Overview

**DevResume AI** is an AI-powered context recovery system that analyzes source code and instantly reconstructs:

- The original development goal
- Current implementation state
- Incomplete logic
- Risks and improvements
- Prioritized next steps
- Momentum Score (completion percentage)

Instead of re-reading entire files, developers receive a structured recovery report in seconds.

---

## ✨ Key Features

### 🧭 Goal Detection
Infers the developer’s original objective from code structure and patterns.

### 🧩 Incomplete Logic Identification
Detects:
- TODO comments  
- `pass` statements  
- Missing return statements  
- Unhandled exceptions  
- Partial implementations  

### 📊 Momentum Score
Calculates:
- Completion percentage  
- Effort required to continue (Low / Medium / High)

### ⚠️ Risk Radar
Highlights:
- Security gaps  
- Missing validations  
- Weak error handling  
- Architectural inconsistencies  

### 🎯 Next-Step Recommendations
Generates three prioritized, actionable tasks to resume development efficiently.

---

## 🏗 Architecture Overview


User (Browser)
↓
Frontend (React / HTML / CSS / JS)
↓
FastAPI Backend
↓
LLM Processing Engine
↓
Structured JSON Context Report
↓
Frontend Visualization


Architecture diagram available at:


/docs/architecture.png


---

## 🛠 Tech Stack

### Frontend
- React
- Tailwind CSS
- Framer Motion

### Backend
- FastAPI
- Python

### AI Engine
- Large Language Model (LLM API)

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/BWT_teamName.git
cd BWT_teamName
2️⃣ Backend Setup
pip install -r requirements.txt
uvicorn main:app --reload

Backend runs at:

http://localhost:8000
3️⃣ Frontend Setup
npm install
npm run dev

Frontend runs at:

http://localhost:3000
📡 API Endpoint
POST /analyze

Request:

{
  "code": "your source code here",
  "level": "Beginner | Intermediate | Advanced"
}

Response:

{
  "goal": "...",
  "current_state": "...",
  "next_steps": ["...", "...", "..."],
  "momentum_score": 45,
  "effort": "Medium",
  "risks": ["...", "..."]
}
🌍 Use Cases

Returning to unfinished projects

Hackathon recovery

Large enterprise codebases

Developer onboarding

Code review assistance

Refactoring planning

🚀 Future Scope

VS Code Extension Integration

GitHub Repository Auto-Analysis

Commit History Context Tracking

Team Knowledge Memory System

AI Code Review Mode

Real-time Multi-language Error Detection

👨‍💻 Team

BWT_Techies

Full Stack & AI

Backend & DevOps

Frontend & UX

📈 Why It Matters

Context switching is one of the biggest hidden productivity killers in software development.

DevResume AI reduces:

Cognitive reload time

Re-analysis overhead

Development friction

And increases:

Focus continuity

Development speed

Code awareness

📄 License

MIT License

⭐ Tagline

Ship faster. Resume smarter.


---

If you want, I can also give you:

- 🔥 A more advanced “enterprise-grade” README (for clients)
- 📊 A README with badges (build, version, license)
- 🎯 A minimal hackathon version
- 🧠 A technical deep-dive version for GitHub impress factor

Tell me which one you need.
