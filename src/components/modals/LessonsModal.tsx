/**
 * Interactive Networking Classroom & Pedagogy Modal
 * Step-by-step interactive lessons explaining wireless multi-mesh,
 * routing algorithms, RF path loss, and fault recovery.
 */

import React, { useState } from 'react';
import { X, BookOpen, Play, CheckCircle, ArrowRight, Lightbulb, Calculator } from 'lucide-react';
import { NETWORKING_LESSONS, NetworkingLesson } from '../../data/networkingLessons';

interface LessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunLessonExperiment: (lesson: NetworkingLesson) => void;
}

export const LessonsModal: React.FC<LessonsModalProps> = ({
  isOpen,
  onClose,
  onRunLessonExperiment
}) => {
  const [selectedLessonId, setSelectedLessonId] = useState<string>(NETWORKING_LESSONS[0].id);

  if (!isOpen) return null;

  const currentLesson = NETWORKING_LESSONS.find(l => l.id === selectedLessonId) || NETWORKING_LESSONS[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700/60 bg-[#0F172A] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100">Interactive Data Communication Tutorials</h2>
              <p className="text-xs text-slate-400">Step-by-step interactive lessons on multi-mesh protocols & RF physics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Lessons Directory */}
          <div className="w-72 border-r border-slate-700/60 bg-slate-900/60 p-3 overflow-y-auto space-y-1.5 custom-scrollbar">
            {NETWORKING_LESSONS.map((lesson, idx) => (
              <button
                key={lesson.id}
                onClick={() => setSelectedLessonId(lesson.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedLessonId === lesson.id
                    ? 'bg-purple-600/20 border-purple-500/60 text-purple-200 shadow-sm'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">
                    {lesson.category}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{lesson.durationMinutes} min</span>
                </div>
                <div className="font-semibold text-xs leading-snug">{lesson.title}</div>
              </button>
            ))}
          </div>

          {/* Right: Active Lesson Detailed Content */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5 bg-[#1E293B]">
            <div>
              <span className="text-xs font-mono text-purple-400 uppercase tracking-wider block mb-1">
                {currentLesson.category} • Module {currentLesson.id}
              </span>
              <h3 className="text-xl font-bold text-slate-100 mb-1">{currentLesson.title}</h3>
              <p className="text-sm text-sky-400 font-medium">{currentLesson.tagline}</p>
            </div>

            {/* Core Lesson Explanations */}
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              {currentLesson.content.map((paragraph, pIdx) => (
                <p key={pIdx} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/80">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Mathematical Formula Callout */}
            {currentLesson.keyFormula && (
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50 flex items-start space-x-3">
                <Calculator className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-purple-300 mb-1">Mathematical Formula:</div>
                  <div className="font-mono text-sm font-bold text-slate-100 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">
                    {currentLesson.keyFormula}
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Experiment Goal */}
            <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-800/50 flex items-start space-x-3">
              <Lightbulb className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-sky-300 mb-1">Simulation Experiment:</div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">{currentLesson.experimentGoal}</p>

                <button
                  onClick={() => {
                    onRunLessonExperiment(currentLesson);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors flex items-center space-x-2 shadow-lg shadow-sky-600/30"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Load Benchmark & Run Experiment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
