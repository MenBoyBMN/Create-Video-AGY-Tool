import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface SceneErrorCardProps {
  projectId: string;
  beatId: string;
  sceneName: string;
  stage: 'compile' | 'runtime';
  message: string;
  detail?: string;
  onCopyError?: () => void;
}

export const SceneErrorCard: React.FC<SceneErrorCardProps> = ({
  projectId,
  beatId,
  sceneName,
  stage,
  message,
  detail,
  onCopyError,
}) => {
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 30% 20%, #2a121e 0%, #090b10 70%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 72,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          width: '100%',
          background: 'rgba(16, 20, 30, 0.92)',
          border: '2px solid rgba(244, 63, 94, 0.55)',
          borderRadius: 24,
          padding: 40,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <span
            style={{
              background: 'rgba(244, 63, 94, 0.2)',
              color: '#fb7185',
              border: '1px solid rgba(244, 63, 94, 0.5)',
              borderRadius: 999,
              padding: '6px 16px',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {stage === 'compile' ? 'CUSTOM SCENE COMPILE ERROR' : 'CUSTOM SCENE RUNTIME ERROR'}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 20, fontFamily: 'monospace' }}>
            {projectId} / scenes/{sceneName}.tsx ({beatId})
          </span>
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#fecdd3',
            marginBottom: 16,
            lineHeight: 1.35,
          }}
        >
          {message}
        </div>

        {detail && (
          <pre
            style={{
              background: '#07090e',
              border: '1px solid #262e42',
              borderRadius: 14,
              padding: 20,
              fontSize: 18,
              lineHeight: 1.5,
              color: '#cbd5e1',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 280,
              overflow: 'auto',
              marginBottom: 24,
            }}
          >
            {detail}
          </pre>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#94a3b8', fontSize: 18 }}>
            Lỗi đã được cô lập — các cảnh khác & Timeline vẫn hoạt động bình thường.
          </span>
          {onCopyError && (
            <button
              type="button"
              onClick={onCopyError}
              style={{
                background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '14px 24px',
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
            >
              Copy lỗi cho AGY sửa ngay
            </button>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

interface SceneErrorBoundaryProps {
  projectId: string;
  beatId: string;
  sceneName: string;
  resetKey: string;
  onCopyError?: (payload: {
    projectId: string;
    beatId: string;
    sceneName: string;
    errorMessage: string;
    stack?: string;
  }) => void;
  children: React.ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  stack?: string;
}

export class SceneErrorBoundary extends React.Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  constructor(props: SceneErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || String(error),
      stack: error?.stack,
    };
  }

  componentDidUpdate(prevProps: SceneErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '', stack: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <SceneErrorCard
          projectId={this.props.projectId}
          beatId={this.props.beatId}
          sceneName={this.props.sceneName}
          stage="runtime"
          message={this.state.errorMessage}
          detail={this.state.stack}
          onCopyError={
            this.props.onCopyError
              ? () =>
                  this.props.onCopyError?.({
                    projectId: this.props.projectId,
                    beatId: this.props.beatId,
                    sceneName: this.props.sceneName,
                    errorMessage: this.state.errorMessage,
                    stack: this.state.stack,
                  })
              : undefined
          }
        />
      );
    }
    return this.props.children;
  }
}
