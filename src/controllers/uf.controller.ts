import { Request, Response } from 'express';

// Cache simple en memoria: almacena el valor UF y la fecha en que se cargó
let cachedUf: { valor: number; fecha: string; cachedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export async function getUfHandler(_req: Request, res: Response) {
  try {
    // Retornar desde caché si sigue vigente
    if (cachedUf && Date.now() - cachedUf.cachedAt < CACHE_TTL_MS) {
      return res.json({ status: 'ok', data: { valor: cachedUf.valor, fecha: cachedUf.fecha } });
    }

    // findic.cl es una API pública chilena que expone indicadores económicos
    const response = await fetch('https://findic.cl/api/uf');
    if (!response.ok) {
      throw new Error(`Error al consultar findic.cl: ${response.status}`);
    }

    const json = (await response.json()) as {
      serie: Array<{ fecha: string; valor: number }>;
    };

    if (!json.serie || json.serie.length === 0) {
      throw new Error('Respuesta inesperada de findic.cl');
    }

    const ultimo = json.serie[0];
    cachedUf = {
      valor: ultimo.valor,
      fecha: ultimo.fecha,
      cachedAt: Date.now(),
    };

    return res.json({ status: 'ok', data: { valor: cachedUf.valor, fecha: cachedUf.fecha } });
  } catch (err) {
    console.error('[UF] Error al obtener valor UF:', err);
    return res.status(502).json({
      status: 'error',
      message: 'No se pudo obtener el valor UF. Intente más tarde.',
    });
  }
}
