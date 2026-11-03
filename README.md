# Automated Learning System Prototype

A classroom-focused learning management system prototype for students, teachers, and administrators.

## Overview

This project combines student login, teacher access, admin controls, and AI-generated assessments into a single web application. It is designed as a local prototype for school use and can be deployed to Render for public access.

## Project status

- Teacher login and teacher account creation are working
- Teacher dashboard shows student progress and class data
- Teachers can maintain a year-long lesson and assessment plan visible to administrators
- Admin dashboard can activate or close tests
- AI test generator creates questions from teacher prompts and lesson files
- Generated tests can be published immediately for students
- Student data is grouped by strand in a folder-style layout
- Deployment configuration is already prepared for Render

## Features

- Student account creation and login
- Teacher login with password validation
- Shared teacher dashboard for monitoring performance
- Shared yearly teaching plan so administrators can identify planned assessments during teacher absences
- Admin controls for classroom operations
- AI test generation from a teacher prompt, lesson file, or both
- Auto-publish option for generated tests
- Student records grouped by strand
- Student calendar with month, week, day, and agenda views
- Teacher/admin-managed school events and student-specific study reminders
- Dark mode across the app, including student sign-up, with per-device accent color, text size, and reduced-motion settings
- Simple local server and public hosting support

## Demo credentials

### Teacher

- Username: `teacher`
- Password: `teacher123`

## Quick start

```powershell
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## AI test maker

The app accepts a teacher's prompt, a lesson file, or both together. Lesson files may use:

- `.pdf`
- `.docx`
- `.pptx`

The generator follows the teacher's requested topic, audience, difficulty, and question count when using an AI provider. It extracts lesson text from uploaded files and turns the source material into multiple-choice questions. Lesson-file-only generation falls back to a demo generator if no AI is available; prompt-based generation requires Ollama or an API key.

To use an API key:

```powershell
$env:OPENAI_API_KEY = "your-key"
npm start
```

For local AI with Ollama:

```powershell
ollama pull llama3.2
npm start
```

## Deployment

This project is configured for Render deployment.

1. Push the repo to GitHub
2. Create a Render web service
3. Connect the repository
4. Use these build settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy

## Notes

This is a prototype for classroom demonstration and internal educational use. It is focused on showing the complete flow from student access to teacher review and admin activation without requiring a full production backend.

Student study reminders are associated with the student's account and are not shown in teacher/admin calendar screens. The prototype's existing account API exposes shared account data, so this is not server-enforced privacy; do not store sensitive information.
