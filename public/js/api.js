// Unified API Client for PALLET
const API = {
  // Questions
  async getActiveQuestions() {
    const res = await fetch('/api/questions');
    return await res.json();
  },
  async getAllQuestions() {
    const res = await fetch('/api/questions/all');
    return await res.json();
  },
  async createQuestion(data) {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async updateQuestion(id, data) {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async deleteQuestion(id) {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  },
  async resetQuestions() {
    const res = await fetch('/api/questions/reset', {
      method: 'POST'
    });
    return await res.json();
  },

  // Classes & Students
  async getClasses() {
    const res = await fetch('/api/classes');
    return await res.json();
  },
  async getClassDetail(classId) {
    const res = await fetch(`/api/classes/${encodeURIComponent(classId)}`);
    return await res.json();
  },
  async getStudents(classId) {
    const url = classId ? `/api/students?class=${encodeURIComponent(classId)}` : '/api/students';
    const res = await fetch(url);
    return await res.json();
  },
  async submitStudentAssessment(data) {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async deleteStudent(id) {
    const res = await fetch(`/api/students/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // Auth
  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  },
  async checkMe() {
    const res = await fetch('/api/auth/me');
    return await res.json();
  },
  async logout() {
    const res = await fetch('/api/auth/logout', {
      method: 'POST'
    });
    return await res.json();
  },

  // Calendar
  async getCalendar() {
    const res = await fetch('/api/calendar');
    return await res.json();
  },
  async addCalendarEvent(data) {
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async toggleCalendarEvent(id, completed) {
    const res = await fetch(`/api/calendar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    });
    return await res.json();
  },
  async deleteCalendarEvent(id) {
    const res = await fetch(`/api/calendar/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // Rubric
  async getRubric(studentId) {
    const res = await fetch(`/api/rubric/${studentId}`);
    return await res.json();
  },
  async saveRubric(data) {
    const res = await fetch('/api/rubric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  }
};
