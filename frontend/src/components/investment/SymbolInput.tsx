import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

interface Props {
  symbol: string;
  name: string;
  onSymbolChange: (symbol: string) => void;
  onNameChange: (name: string) => void;
}

const COMPLETE_CODE = /^[A-Z0-9]{6}$/;
const COMPLETE_SYMBOL = /^[A-Z0-9]{6}\.(KS|KQ)$/i;

function isReadyToLookup(value: string): boolean {
  const q = value.trim().toUpperCase().replace(/\.+$/, '');
  return COMPLETE_CODE.test(q) || COMPLETE_SYMBOL.test(q);
}

export default function SymbolInput({ symbol, name, onSymbolChange, onNameChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const lastLookup = useRef('');

  useEffect(() => {
    const q = symbol.trim().toUpperCase().replace(/\.+$/, '');
    if (!isReadyToLookup(symbol)) {
      setError(null);
      if (!q) setAutoFilled(false);
      return;
    }
    if (q === lastLookup.current) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await api.searchMarket(q);
        if (results.length === 0) {
          setError('종목을 찾을 수 없습니다');
          setAutoFilled(false);
          return;
        }
        const match = results[0];
        lastLookup.current = match.symbol;
        onSymbolChange(match.symbol);
        onNameChange(match.name);
        setAutoFilled(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : '종목 조회 실패');
        setAutoFilled(false);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [symbol]);

  const handleSymbolChange = (value: string) => {
    lastLookup.current = '';
    setAutoFilled(false);
    setError(null);
    onSymbolChange(value.toUpperCase());
    if (!value.trim()) onNameChange('');
  };

  return (
    <div className="form-row">
      <div className="form-group">
        <label>종목코드</label>
        <input
          value={symbol}
          onChange={(e) => handleSymbolChange(e.target.value)}
          placeholder="005930 또는 0177R0"
        />
        {loading && <span className="symbol-lookup-status">조회 중...</span>}
        {!loading && error && <span className="symbol-lookup-status symbol-lookup-status--error">{error}</span>}
        {!loading && !error && symbol && !isReadyToLookup(symbol) && (
          <span className="symbol-lookup-status">6자리 종목코드를 입력하세요 (숫자·영문)</span>
        )}
      </div>
      <div className="form-group">
        <label>종목명</label>
        <input
          value={name}
          onChange={(e) => { setAutoFilled(false); onNameChange(e.target.value); }}
          placeholder={loading ? '조회 중...' : '자동 입력'}
          readOnly={autoFilled && !error}
          className={autoFilled ? 'input-readonly' : ''}
        />
      </div>
    </div>
  );
}
