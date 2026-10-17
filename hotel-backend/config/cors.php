<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS)
|--------------------------------------------------------------------------
|
| Orígenes permitidos:
|  - FRONTEND_URL (URL pública de la SPA)
|  - CORS_ALLOWED_ORIGINS: lista adicional separada por comas
|  - http://localhost:5173 y http://127.0.0.1:5173 (desarrollo con Vite)
|
| CORS_ALLOWED_ORIGIN_PATTERNS: expresiones regulares separadas por comas
| (vacío por defecto). Ej.: #^https://mi-app-[a-z0-9-]+\.vercel\.app$#
|
*/

$splitEnv = static function (?string $value): array {
    if ($value === null || trim($value) === '') {
        return [];
    }

    return array_values(array_filter(array_map(
        static fn ($item) => rtrim(trim($item), '/'),
        explode(',', $value)
    )));
};

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        [rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/')],
        $splitEnv(env('CORS_ALLOWED_ORIGINS')),
        ['http://localhost:5173', 'http://127.0.0.1:5173'],
    )))),

    'allowed_origins_patterns' => $splitEnv(env('CORS_ALLOWED_ORIGIN_PATTERNS')),

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 600,

    /*
    | La SPA se autentica con token Bearer, no con cookies. Sin embargo el
    | cliente axios actual envía `withCredentials: true`; con credenciales el
    | navegador exige Access-Control-Allow-Credentials: true y un origen
    | explícito (nunca "*"). Como los orígenes están restringidos arriba, se
    | puede mantener en true sin riesgo; poner CORS_SUPPORTS_CREDENTIALS=false
    | cuando el frontend deje de usar withCredentials.
    */
    'supports_credentials' => filter_var(env('CORS_SUPPORTS_CREDENTIALS', true), FILTER_VALIDATE_BOOLEAN),

];
