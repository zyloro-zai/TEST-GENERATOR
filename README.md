# Project ATLAS

A classroom-focused learning management system prototype for students, teachers, and administrators.

## Overview

This project combines student login, teacher access, admin controls, and AI-generated assessments into a single web application. It is designed as a local prototype for school use and can be deployed to Render for public access.

## Project status

- Teacher login and teacher account creation are working
- Teacher dashboard shows student progress and class data
- Teachers can maintain a year-long lesson and assessment plan visible to administrators
- Teachers and administrators can open or close published tests for students
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
- Student and teacher calendars with month, week, day, and agenda views
- Teacher/admin-managed school events, student study reminders, and private teacher tasks with completion checklists
- Optional three-question daily challenge rotating through prepared topics, with immediate explanations and a completion badge saved to the student's account
- Student progress badges: First Steps for a first completed test, Curious Learner for three different assessments, Improving Star for a better score on a retake, and Daily Learner for completing a daily challenge
- Teacher calendar combines published school events with the signed-in teacher's private tasks; teachers can edit or delete their published tests
- Test open/closed state is shared across devices through the server or ESP32
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

The generator follows the teacher's requested topic, audience, difficulty, and question count when using an AI provider. It extracts lesson text from uploaded files and asks the AI to assess core learning concepts rather than incidental classroom directions. Both prompt-based and lesson-file generation require Ollama or an API key; without an AI provider, generation returns an error instead of publishing unreliable sample questions.

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

Student study reminders and teacher private tasks are associated with their respective accounts and are not shown in other roles' calendar screens. The prototype's account APIs expose shared account data, so this is not server-enforced privacy; do not store sensitive information.
