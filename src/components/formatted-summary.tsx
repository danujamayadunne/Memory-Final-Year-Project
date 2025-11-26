"use client"

import * as React from "react"

interface FormattedSummaryProps {
  content: string
  className?: string
}

function cleanSummaryText(text: string): string {

  const prefixes = [
    /^here's a summary[:\s]*/i,
    /^summary[:\s]*/i,
    /^here's what[:\s]*/i,
    /^here are the key points[:\s]*/i,
    /^key points[:\s]*/i,
    /^main points[:\s]*/i,
    /^overview[:\s]*/i,
    /^here's the summary[:\s]*/i,
    /^the summary[:\s]*/i,
    /^in summary[,\s]*/i,
    /^to summarize[,\s]*/i,
  ];

  let cleaned = text.trim();

  const lines = cleaned.split('\n');

  if (lines.length > 1) {
    const firstLine = lines[0].trim();
    const isIntroPhrase = prefixes.some(prefix => prefix.test(firstLine)) ||
      (firstLine.length < 50 && !/^[-•*]\s/.test(firstLine) && !/^\d+[.)]\s/.test(firstLine));

    if (isIntroPhrase) {
      lines.shift();
      cleaned = lines.join('\n').trim();
    }
  }

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '').trim();
  }

  cleaned = cleaned.replace(/^[:\-\s]+/, '').trim();

  return cleaned;
}

export function FormattedSummary({ content, className = "" }: FormattedSummaryProps) {
  const cleanedContent = cleanSummaryText(content)

  const lines = cleanedContent.split('\n').filter(line => line.trim())

  const hasBullets = lines.some(line => {
    const trimmed = line.trim()
    return /^[-•*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)
  })

  if (hasBullets) {
    const items = lines.map((line, index) => {
      const trimmed = line.trim()
      const cleanText = trimmed
        .replace(/^[-•*]\s+/, '')
        .replace(/^\d+[.)]\s+/, '')
        .trim()

      if (!cleanText) return null

      return (
        <li key={index} className="mb-2.5 leading-relaxed flex items-start">
          <span className="mr-3 mt-1.5 flex-shrink-0 text-foreground/60 font-bold">•</span>
          <span className="flex-1">{cleanText}</span>
        </li>
      )
    }).filter(Boolean)

    return (
      <ul className={`space-y-1.5 ${className}`}>
        {items}
      </ul>
    )
  }

  const paragraphs: string[] = [];
  let currentParagraph = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      if (currentParagraph) {
        currentParagraph += ' ' + line;
      } else {
        currentParagraph = line;
      }
    } else {
      if (currentParagraph) {
        paragraphs.push(currentParagraph);
        currentParagraph = '';
      }
    }
  }

  if (currentParagraph) {
    paragraphs.push(currentParagraph);
  }

  if (paragraphs.length === 1 && paragraphs[0].length > 500) {
    const longPara = paragraphs[0];
    const sentences = longPara.match(/[^.!?]+[.!?]+/g) || [longPara];
    if (sentences.length >= 4) {
      const midPoint = Math.floor(sentences.length / 2);
      const firstHalf = sentences.slice(0, midPoint).join(' ').trim();
      const secondHalf = sentences.slice(midPoint).join(' ').trim();
      if (firstHalf && secondHalf) {
        paragraphs[0] = firstHalf;
        paragraphs.push(secondHalf);
      }
    }
  }

  return (
    <div className={className}>
      {paragraphs.map((para, index) => (
        <p key={index} className="mb-4 leading-relaxed last:mb-0 text-foreground/90">
          {para}
        </p>
      ))}
    </div>
  )
}

