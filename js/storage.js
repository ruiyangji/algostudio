/**
 * AlgoStudio Question Storage Client Service
 */

const storageService = {
  async listQuestions() {
    const res = await fetch('/api/questions');
    if (!res.ok) throw new Error('Failed to fetch questions');
    return await res.json();
  },

  async getQuestion(id) {
    const res = await fetch(`/api/question?id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Question ${id} not found`);
    return await res.json();
  },

  async createQuestion(questionData) {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create question');
    return data;
  },

  async updateQuestion(id, questionData) {
    const payload = { ...questionData, id: id };
    const res = await fetch('/api/questions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update question');
    return data;
  },

  async deleteQuestion(id) {
    const res = await fetch(`/api/questions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete question');
    return data;
  },

};
