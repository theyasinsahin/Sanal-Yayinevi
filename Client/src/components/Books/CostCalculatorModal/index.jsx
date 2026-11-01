import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../UI/Button';

// Compatibility for older callers: estimates are now server-side and require review.
export const CostCalculatorModal = ({ book, onClose }) => <div className="modal-overlay"><section className="modal-content" role="dialog" aria-modal="true" aria-label="Basım başvurusu"><h2>Basım maliyeti ve başvuru</h2><p>Maliyet güncel tarife ve sabitlenmiş basım sürümünden sunucuda hesaplanır. Yönetici onayından sonra kampanya açılır.</p><Link to={`/print/${book.id}`}>Basım başvurusuna git</Link><Button onClick={onClose}>Kapat</Button></section></div>;