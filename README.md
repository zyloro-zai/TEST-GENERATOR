# Automated Learning System Prototype

A classroom-focused learning management system prototype for students, teachers, and administrators.

## Overview

This project combines student login, teacher access, admin controls, and AI-generated assessments into a single web application. It is designed as a local prototype for school use and can be deployed to Render for public access.

## Project status

- Teacher login and teacher account creation are working
- Teacher dashboard shows student progress and class data
- Admin dashboard can activate or close tests
- AI test generator reads lesson files and creates questions automatically
- Generated tests can be published immediately for students
- Student data is grouped by strand in a folder-style layout
- Deployment configuration is already prepared for Render

## Features

- Student account creation and login
- Teacher login with teacher code validation
- Shared teacher dashboard for monitoring performance
- Admin controls for classroom operations
- AI lesson-to-test generation from PDF, DOCX, and PPTX
- Auto-publish option for generated tests
- Student records grouped by strand
- Simple local server and public hosting support

## Demo credentials

### Teacher

- Username: `teacher`
- Password: `teacher123`
- Code: `AUJRCteacher`

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

The app accepts lesson files in the following formats:

- `.pdf`
- `.docx`
- `.pptx`

The generator extracts text and turns it into multiple-choice questions. If no AI key is configured, it falls back to a demo generator.

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
