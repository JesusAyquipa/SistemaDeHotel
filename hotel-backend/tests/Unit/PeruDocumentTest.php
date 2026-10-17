<?php

namespace Tests\Unit;

use App\Support\PeruDocument;
use PHPUnit\Framework\TestCase;

class PeruDocumentTest extends TestCase
{
    public function test_valid_rucs_pass_check_digit(): void
    {
        foreach (['20100070970', '20131312955', '10467793549', '20601030013', '20100047218'] as $ruc) {
            $this->assertTrue(PeruDocument::isValidRuc($ruc), $ruc);
        }
    }

    public function test_invalid_rucs_are_rejected(): void
    {
        $this->assertFalse(PeruDocument::isValidRuc('20100070971'));   // dígito verificador incorrecto
        $this->assertFalse(PeruDocument::isValidRuc('30100070970'));   // prefijo no permitido
        $this->assertFalse(PeruDocument::isValidRuc('2010007097'));    // 10 dígitos
        $this->assertFalse(PeruDocument::isValidRuc('2010007097A'));
        $this->assertFalse(PeruDocument::isValidRuc(''));
        $this->assertFalse(PeruDocument::isValidRuc(null));
    }

    public function test_dni_and_other_documents(): void
    {
        $this->assertTrue(PeruDocument::isValid('DNI', '12345678'));
        $this->assertFalse(PeruDocument::isValid('DNI', '1234567'));
        $this->assertFalse(PeruDocument::isValid('DNI', '123456789'));
        $this->assertTrue(PeruDocument::isValid('CE', '001234567'));
        $this->assertTrue(PeruDocument::isValid('PAS', 'AB123456'));
        $this->assertFalse(PeruDocument::isValid('XYZ', '12345678'));
    }
}
