export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return Response.json(
        { error: { code: 'METHOD_NOT_ALLOWED', message: 'Метод не поддерживается.' } },
        { status: 405, headers: { Allow: 'GET' } }
      );
    }

    return Response.json({ ok: true });
  }
};
