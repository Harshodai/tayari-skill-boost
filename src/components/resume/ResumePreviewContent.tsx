import type { ParsedResume } from "@/types/resume";
import { cn } from "@/lib/utils";

interface ResumePreviewContentProps {
  parsedResume: ParsedResume;
  template: string;
  className?: string;
}

const templateStyles: Record<string, {
  headerBg: string;
  accentColor: string;
  layout: "single" | "two-column";
  fontStyle: string;
}> = {
  modern: {
    headerBg: "bg-primary/10",
    accentColor: "text-primary",
    layout: "two-column",
    fontStyle: "font-sans",
  },
  professional: {
    headerBg: "bg-muted",
    accentColor: "text-foreground",
    layout: "single",
    fontStyle: "font-serif",
  },
  creative: {
    headerBg: "bg-gradient-to-r from-warning/20 to-destructive/20",
    accentColor: "text-warning",
    layout: "two-column",
    fontStyle: "font-sans",
  },
  minimal: {
    headerBg: "bg-transparent",
    accentColor: "text-muted-foreground",
    layout: "single",
    fontStyle: "font-sans",
  },
  tech: {
    headerBg: "bg-secondary/10",
    accentColor: "text-secondary",
    layout: "two-column",
    fontStyle: "font-mono",
  },
  executive: {
    headerBg: "bg-gradient-to-r from-background to-card",
    accentColor: "text-primary",
    layout: "single",
    fontStyle: "font-serif",
  },
};

export const ResumePreviewContent = ({ 
  parsedResume, 
  template,
  className 
}: ResumePreviewContentProps) => {
  const style = templateStyles[template] || templateStyles.modern;

  return (
    <div className={cn(
      "bg-white text-black p-8 rounded-lg shadow-lg max-h-[70vh] overflow-y-auto",
      style.fontStyle,
      className
    )}>
      {/* Header Section */}
      <div className={cn("p-6 rounded-lg mb-6", style.headerBg)}>
        <h1 className="text-2xl font-bold text-black">
          {parsedResume.name || "Your Name"}
        </h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
          {parsedResume.email && <span>{parsedResume.email}</span>}
          {parsedResume.phone && <span>• {parsedResume.phone}</span>}
          {parsedResume.linkedin && <span>• {parsedResume.linkedin}</span>}
        </div>
      </div>

      {/* Summary */}
      {parsedResume.summary && (
        <div className="mb-6">
          <h2 className={cn("text-lg font-semibold border-b-2 pb-1 mb-3", style.accentColor, "border-current")}>
            Professional Summary
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            {parsedResume.summary}
          </p>
        </div>
      )}

      {/* Two Column Layout for some templates */}
      <div className={cn(
        style.layout === "two-column" ? "grid grid-cols-3 gap-6" : "space-y-6"
      )}>
        {/* Main Content */}
        <div className={style.layout === "two-column" ? "col-span-2 space-y-6" : "space-y-6"}>
          {/* Experience */}
          {parsedResume.experience.length > 0 && (
            <div>
              <h2 className={cn("text-lg font-semibold border-b-2 pb-1 mb-3", style.accentColor, "border-current")}>
                Experience
              </h2>
              <div className="space-y-4">
                {parsedResume.experience.map((exp, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-black">{exp.title}</h3>
                        <p className="text-gray-600 text-sm">{exp.company}</p>
                      </div>
                      <span className="text-sm text-gray-500">
                        {exp.startDate} - {exp.endDate}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-gray-700 text-sm mt-1">{exp.description}</p>
                    )}
                    {exp.achievements.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-700 mt-2 space-y-1">
                        {exp.achievements.map((achievement, aIdx) => (
                          <li key={aIdx}>{achievement}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {parsedResume.education.length > 0 && (
            <div>
              <h2 className={cn("text-lg font-semibold border-b-2 pb-1 mb-3", style.accentColor, "border-current")}>
                Education
              </h2>
              <div className="space-y-3">
                {parsedResume.education.map((edu, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-black">{edu.degree}</h3>
                      <p className="text-gray-600 text-sm">{edu.institution}</p>
                      {edu.gpa && (
                        <p className="text-gray-500 text-sm">GPA: {edu.gpa}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{edu.year}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {parsedResume.projects && parsedResume.projects.length > 0 && (
            <div>
              <h2 className={cn("text-lg font-semibold border-b-2 pb-1 mb-3", style.accentColor, "border-current")}>
                Projects
              </h2>
              <div className="space-y-3">
                {parsedResume.projects.map((project, idx) => (
                  <div key={idx}>
                    <h3 className="font-semibold text-black">{project.name}</h3>
                    {project.description && (
                      <p className="text-gray-700 text-sm">{project.description}</p>
                    )}
                    {project.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {project.technologies.map((tech, tIdx) => (
                          <span 
                            key={tIdx}
                            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar for two-column layout */}
        {style.layout === "two-column" && (
          <div className="space-y-6">
            {/* Skills */}
            {parsedResume.skills.length > 0 && (
              <div>
                <h2 className={cn("text-lg font-semibold border-b-2 pb-1 mb-3", style.accentColor, "border-current")}>
                  Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {parsedResume.skills.map((skill, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skills for single-column layout */}
      {style.layout === "single" && parsedResume.skills.length > 0 && (
        <div className="mt-6">
          <h2 className={cn("text-lg font-semibold border-b-2 pb-1 mb-3", style.accentColor, "border-current")}>
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {parsedResume.skills.map((skill, idx) => (
              <span 
                key={idx}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumePreviewContent;