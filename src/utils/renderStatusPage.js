import { query } from '../config/db.js';

export function getStatusHtml({ dbStatus, dbLatencyMs, dbTime, dbError }) {
    const isDbConnected = dbStatus === 'connected';
    const statusText = isDbConnected ? 'All Systems Operational' : 'Database Degraded';
    const badgeColor = isDbConnected ? '#34d399' : '#f87171';
    const badgeBg = isDbConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    const badgeBorder = isDbConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    const dotColor = isDbConnected ? '#10b981' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Revati Global API</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2338bdf8'><circle cx='12' cy='12' r='10'/></svg>">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background-color: #0b0f19;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #f8fafc;
        }
        .card {
            background-color: #131c2e;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 48px 40px;
            max-width: 620px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc);
        }
        h1 {
            font-size: 32px;
            font-weight: 800;
            background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
        }
        p {
            color: #94a3b8;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 24px;
            font-weight: 400;
        }
        .status-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 8px 18px;
            background-color: ${badgeBg};
            border: 1px solid ${badgeBorder};
            border-radius: 9999px;
            color: ${badgeColor};
            font-size: 13.5px;
            font-weight: 600;
            letter-spacing: 0.3px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            background-color: ${dotColor};
            border-radius: 50%;
            box-shadow: 0 0 10px ${dotColor};
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .meta-grid {
            margin-top: 20px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            width: 100%;
            text-align: left;
        }
        .meta-box {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid #1e293b;
            border-radius: 10px;
            padding: 12px 16px;
        }
        .meta-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .meta-value {
            font-size: 13.5px;
            font-weight: 600;
            color: #e2e8f0;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: .4; transform: scale(1.2); }
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Revati Global API</h1>
        <p>Enterprise API gateway with active database heartbeat monitoring.</p>
        <div class="status-container">
            <div class="status-badge">
                <span class="status-dot"></span>
                <span>${statusText}</span>
            </div>
            <div class="meta-grid">
                <div class="meta-box">
                    <div class="meta-label">Supabase Database</div>
                    <div class="meta-value" style="color: ${isDbConnected ? '#34d399' : '#f87171'}">
                        ${isDbConnected ? `Connected (${dbLatencyMs}ms)` : 'Disconnected'}
                    </div>
                </div>
                <div class="meta-box">
                    <div class="meta-label">Engine Time (UTC)</div>
                    <div class="meta-value">${dbTime ? new Date(dbTime).toISOString().slice(11, 19) + ' UTC' : 'N/A'}</div>
                </div>
            </div>
            ${dbError ? `<p style="color:#f87171;font-size:12px;margin-top:12px;">Error: ${dbError}</p>` : ''}
        </div>
    </div>
</body>
</html>`;
}

export async function handleStatusResponse(req, res) {
    const startTime = Date.now();
    let dbStatus = 'connected';
    let dbLatencyMs = null;
    let dbTime = null;
    let dbError = null;

    try {
        const { rows } = await query('SELECT NOW() as db_time, 1 as active');
        dbLatencyMs = Date.now() - startTime;
        dbTime = rows[0]?.db_time || new Date().toISOString();
    } catch (err) {
        dbStatus = 'disconnected';
        dbError = err.message;
    }

    const isHealthy = dbStatus === 'connected';
    const statusCode = isHealthy ? 200 : 503;

    if (req.accepts('html') && !req.xhr) {
        res.status(statusCode).setHeader('Content-Type', 'text/html');
        return res.send(getStatusHtml({ dbStatus, dbLatencyMs, dbTime, dbError }));
    }

    return res.status(statusCode).json({
        result: isHealthy ? 'success' : 'error',
        service: 'Revati Global API',
        status: isHealthy ? 'healthy' : 'degraded',
        database: {
            status: dbStatus,
            latencyMs: dbLatencyMs,
            dbTime: dbTime,
            ...(dbError ? { error: dbError } : {})
        },
        timestamp: new Date().toISOString()
    });
}
