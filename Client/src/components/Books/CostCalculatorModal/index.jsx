import React, { useState, useEffect } from 'react';
import { Button } from '../../UI/Button';
import { Select } from '../../UI/Select';
import { Typography } from '../../UI/Typography';
import './CostCalculatorModal.css'; // Modal stilleri

const PAPER_TYPES = [
    { label: 'Enzo (Roman Kağıdı) - Ucuz', value: 'enzo', multiplier: 0.05 },
    { label: 'Ivory (Sarı, Kaliteli)', value: 'ivory', multiplier: 0.08 },
    { label: 'Kuşe (Renkli)', value: 'coated', multiplier: 0.15 },
];

const COVER_TYPES = [
    { label: 'Karton Kapak', value: 'paperback', cost: 15 },
    { label: 'Sert Kapak (Ciltli)', value: 'hardcover', cost: 45 },
];

const BASE_OPERATIONAL_COST = 2000; // Editörlük, mizanpaj vb. sabit giderler (Örnek)

export const CostCalculatorModal = ({ book, pageCount, onClose, onConfirm }) => {
    const [config, setConfig] = useState({
        paperType: 'enzo',
        coverType: 'paperback',
        dimension: '13.5x21'
    });
    
    const [totalCost, setTotalCost] = useState(0);

    // Maliyet Hesaplama Algoritması
    useEffect(() => {
        const paper = PAPER_TYPES.find(p => p.value === config.paperType);
        const cover = COVER_TYPES.find(c => c.value === config.coverType);
        
        // Formül: (Sayfa Sayısı * Kağıt Çarpanı * 1000 Adet) + (Kapak * 1000) + Sabit Gider
        // Not: Bu örnek bir formüldür.
        const printCost = (pageCount * paper.multiplier) + cover.cost;
        const printingTotal = printCost * 100; // Örnek: İlk etapta 100 adet basılacaksa
        
        const final = printingTotal + BASE_OPERATIONAL_COST;
        setTotalCost(Math.ceil(final));
    }, [config, pageCount]);

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <Typography variant="h5" weight="bold" className="mb-4">Baskı Maliyeti Oluşturucu</Typography>
                
                <div className="info-box mb-4">
                    <p>Mevcut Sayfa Sayısı: <strong>{pageCount}</strong></p>
                    <p className="text-sm text-gray-500">Hesaplama 100 adet ilk baskı üzerinden yapılmaktadır.</p>
                </div>

                <div className="form-grid gap-4 mb-6">
                    <Select 
                        label="Kağıt Türü"
                        name="paperType"
                        options={PAPER_TYPES}
                        value={config.paperType}
                        onChange={(e) => setConfig({...config, paperType: e.target.value})}
                    />
                    
                    <Select 
                        label="Kapak Türü"
                        name="coverType"
                        options={COVER_TYPES}
                        value={config.coverType}
                        onChange={(e) => setConfig({...config, coverType: e.target.value})}
                    />
                </div>

                <div className="result-box p-4 bg-gray-100 rounded mb-6 text-center">
                    <Typography variant="body">Hedeflenen Fon Tutarı</Typography>
                    <Typography variant="h2" weight="bold" color="primary">₺ {totalCost}</Typography>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>İptal</Button>
                    <Button variant="success" onClick={() => onConfirm({ config, totalCost })}>
                        Onayla ve Fonlamayı Başlat
                    </Button>
                </div>
            </div>
        </div>
    );
};