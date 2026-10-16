/* Nocta — "Your compliance plan" (Therapy › the compliance card): when the
 * person's compliance window started and what their plan asks for. The same
 * fields as onboarding's step (CompliancePlanFields); for someone who said
 * "yes" later, or whose plan or start date was off. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { setAnswers } from '../lib/profile.js';
import { Sheet } from '../components/Sheet.jsx';
import { CompliancePlanFields } from './Onboarding.jsx';
import { startProblem, ruleFor } from '../data/compliance.js';

export function CompliancePlanSheet() {
  const { closeSheet, profile } = useStore();
  const a = profile.answers;
  const [draft, setDraft] = useState({
    complianceStart: a.complianceStart ?? null,
    complianceRule: a.complianceRule ?? null,
    insuranceProvider: a.insuranceProvider ?? null,
  });
  return (
    <Sheet
      title="Your compliance plan"
      variant="page"
      onClose={closeSheet}
      footer={(close) => (
        <button
          className="btn primary"
          disabled={!draft.complianceStart || Boolean(startProblem(draft.complianceStart, ruleFor(draft)))}
          onClick={() => {
            setAnswers({ complianceStart: draft.complianceStart, complianceRule: draft.complianceRule });
            close();
          }}
        >
          Save
        </button>
      )}
    >
      <div className="cp-sheet">
        <CompliancePlanFields value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
      </div>
    </Sheet>
  );
}
