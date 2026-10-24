// Unified API Client for PALLET
function getAuthHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  const token = localStorage.getItem('pallet_teacher_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const API = {
  // Questions
  async getActiveQuestions() {
    const res = await fetch('/api/questions', {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async getAllQuestions() {
    const res = await fetch('/api/questions/all', {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async createQuestion(data) {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async updateQuestion(id, data) {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async deleteQuestion(id) {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async resetQuestions() {
    const res = await fetch('/api/questions/reset', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // Classes & Students
  async getClasses() {
    const res = await fetch('/api/classes', {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async getClassDetail(classId) {
    const res = await fetch(`/api/classes/${encodeURIComponent(classId)}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async getStudents(classId) {
    const url = classId ? `/api/students?class=${encodeURIComponent(classId)}` : '/api/students';
    const res = await fetch(url, {
      headers: getAuthHeaders()
    });
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
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async bulkDeleteStudents(ids) {
    const res = await fetch('/api/students/bulk-delete', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids })
    });
    return await res.json();
  },
  async updateStudent(id, data) {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async createStudent(data) {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // Live Progress & Real-time Monitoring
  async sendLiveProgress(data) {
    try {
      const res = await fetch('/api/students/live-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      // Non-blocking for offline
      return null;
    }
  },
  async getLiveMonitor(classId) {
    const url = classId ? `/api/students/live-monitor?class=${encodeURIComponent(classId)}` : '/api/students/live-monitor';
    const res = await fetch(url, {
      headers: getAuthHeaders()
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
    const data = await res.json();
    if (data && data.status === 'success' && data.token) {
      localStorage.setItem('pallet_teacher_token', data.token);
    }
    return data;
  },
  async checkMe() {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } finally {
      localStorage.removeItem('pallet_teacher_token');
    }
    return { status: 'success' };
  },

  // Calendar
  async getCalendar() {
    const res = await fetch('/api/calendar', {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async addCalendarEvent(data) {
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async toggleCalendarEvent(id, completed) {
    const res = await fetch(`/api/calendar/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ completed })
    });
    return await res.json();
  },
  async deleteCalendarEvent(id) {
    const res = await fetch(`/api/calendar/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // Rubric
  async getClassRubric(classId) {
    const res = await fetch(`/api/rubric/class/${encodeURIComponent(classId)}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async getRubric(studentId) {
    const res = await fetch(`/api/rubric/${studentId}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async saveRubric(data) {
    const res = await fetch('/api/rubric', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // Portfolios (Tahap 9 CRUD)
  async getPortfolios(classId) {
    const res = await fetch(`/api/portfolio/${encodeURIComponent(classId)}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async getPortfolioItem(id) {
    const res = await fetch(`/api/portfolio/item/${id}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },
  async createPortfolio(data) {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async updatePortfolio(id, data) {
    const res = await fetch(`/api/portfolio/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async deletePortfolio(id) {
    const res = await fetch(`/api/portfolio/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  }
};
