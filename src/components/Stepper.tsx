"use client";

interface StepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
}

const STEPS = [
  { num: 1, label: "Tanggal & Tamu" },
  { num: 2, label: "Pilih Ruangan" },
  { num: 3, label: "Pilih Menu" },
  { num: 4, label: "Bayar" },
  { num: 5, label: "E-Tiket" },
];

export function Stepper({ currentStep }: StepperProps) {
  const currentLabel = STEPS.find((s) => s.num === currentStep)?.label || "";

  return (
    <div className="w-full bg-white border-b border-[#DFDDD6] py-3 px-4 shadow-xs">
      <div className="max-w-4xl mx-auto">
        {/* Mobile View: < 768px */}
        <div className="md:hidden flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1C2955]">
              Langkah {currentStep} dari 5:{" "}
              <span className="text-[#D81B60]">{currentLabel}</span>
            </span>
            <span className="text-gray-500 font-mono text-[11px]">
              {Math.round((currentStep / 5) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#D81B60] h-full transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop View: >= 768px */}
        <div className="hidden md:flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isPassed = step.num < currentStep;
            const isCurrent = step.num === currentStep;

            return (
              <div key={step.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isCurrent
                        ? "bg-[#1C2955] text-white ring-4 ring-[#1C2955]/10"
                        : isPassed
                        ? "bg-[#D81B60] text-white"
                        : "bg-gray-100 text-gray-500 border border-gray-300"
                    }`}
                  >
                    {isPassed ? "✓" : step.num}
                  </div>
                  <span
                    className={`text-xs whitespace-nowrap font-medium ${
                      isCurrent
                        ? "text-[#1C2955] font-bold"
                        : isPassed
                        ? "text-gray-700"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 transition-colors ${
                      isPassed ? "bg-[#D81B60]" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
