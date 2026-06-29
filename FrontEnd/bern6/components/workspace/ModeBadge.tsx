import React from 'react';

/**
 * Tiny tag indicating where a calc-parameter value comes from.
 * Mirrors the convention used by calengine-ui (BERSn 2024 Manual style):
 *   - Lookup     : auto-filled from a standard table
 *   - Manual     : user must enter
 *   - Calculated : derived from a formula
 */
export type ParamMode = 'lookup' | 'manual' | 'calculated';

const PALETTE: Record<ParamMode, { bg: string; text: string; label: { zh: string; en: string } }> = {
  lookup: {
    bg: 'rgba(59, 130, 246, 0.15)',
    text: '#1d4ed8',
    label: { zh: 'Lookup', en: 'Lookup' },
  },
  manual: {
    bg: 'rgba(245, 158, 11, 0.18)',
    text: '#a16207',
    label: { zh: 'Manual', en: 'Manual' },
  },
  calculated: {
    bg: 'rgba(16, 185, 129, 0.15)',
    text: '#047857',
    label: { zh: 'Calc', en: 'Calc' },
  },
};

interface Props {
  mode: ParamMode;
  lang?: 'zh' | 'en';
}

const ModeBadge: React.FC<Props> = ({ mode, lang = 'zh' }) => {
  const c = PALETTE[mode];
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        padding: '1px 7px',
        borderRadius: '999px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1.4,
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {c.label[lang]}
    </span>
  );
};

export default ModeBadge;
