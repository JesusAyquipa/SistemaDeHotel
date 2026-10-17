<?php

namespace App\Services;

/**
 * Validación básica de contenido de reseñas (SHE-037): filtro de lenguaje ofensivo.
 */
class ReviewModeration
{
    /** Lista básica de términos ofensivos (español / inglés). */
    private const BLOCKED_WORDS = [
        'mierda', 'puta', 'puto', 'putas', 'putos', 'carajo', 'cojudo', 'cojuda', 'huevón', 'huevon',
        'conchatumadre', 'concha de tu madre', 'ctm', 'csm', 'pendejo', 'pendeja', 'imbécil', 'imbecil',
        'idiota', 'estúpido', 'estupido', 'estúpida', 'estupida', 'maricón', 'maricon', 'cabrón', 'cabron',
        'gilipollas', 'joder', 'coño', 'verga', 'chucha',
        'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'bastard',
    ];

    public static function containsProfanity(string $text): bool
    {
        $normalized = mb_strtolower($text);

        foreach (self::BLOCKED_WORDS as $word) {
            $pattern = '/(?<![\p{L}\p{N}])' . preg_quote(mb_strtolower($word), '/') . '(?![\p{L}\p{N}])/u';
            if (preg_match($pattern, $normalized)) {
                return true;
            }
        }

        return false;
    }
}
