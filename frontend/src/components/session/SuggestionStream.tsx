interface SuggestionStreamProps {
  text: string;
  isStreaming: boolean;
}

export function SuggestionStream({ text, isStreaming }: SuggestionStreamProps) {
  if (!text && !isStreaming) return null;

  return (
    <div
      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
      data-testid="suggestion-stream"
    >
      <h4 className="text-sm font-semibold text-gray-700 mb-2">AI Analysis</h4>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {text}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse" />
        )}
      </p>
    </div>
  );
}
