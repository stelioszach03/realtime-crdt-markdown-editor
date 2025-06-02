/**
 * Document template selection component
 */
import React from 'react';
import { 
  FileText, 
  Code, 
  BookOpen, 
  Briefcase, 
  ListChecks,
  Lightbulb,
  FileCode,
  Newspaper,
  GraduationCap,
  Users,
  Target
} from 'lucide-react';
import { Button } from '../Shared/Button';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  content: string;
  category: 'personal' | 'work' | 'technical' | 'creative';
}

const templates: Template[] = [
  {
    id: 'readme',
    name: 'README.md',
    description: 'Project documentation template',
    icon: <FileCode className="h-6 w-6" />,
    category: 'technical',
    content: `# Project Name

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/username/project)

## Description

A brief description of what this project does and who it's for.

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`bash
npm install project-name
\`\`\`

## Usage

\`\`\`javascript
const project = require('project-name');
// Example usage
\`\`\`

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

[MIT](https://choosealicense.com/licenses/mit/)`
  },
  {
    id: 'blog-post',
    name: 'Blog Post',
    description: 'Standard blog post format',
    icon: <Newspaper className="h-6 w-6" />,
    category: 'creative',
    content: `# Blog Post Title

*Published on: ${new Date().toLocaleDateString()}*

## Introduction

Start with a compelling hook that draws readers in...

## Main Content

### Section 1

Your first main point...

### Section 2

Your second main point...

### Section 3

Your third main point...

## Conclusion

Wrap up your thoughts and provide a call-to-action...

---

**Tags:** #tag1 #tag2 #tag3

**Author:** Your Name`
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Professional meeting documentation',
    icon: <Users className="h-6 w-6" />,
    category: 'work',
    content: `# Meeting Notes

**Date:** ${new Date().toLocaleDateString()}  
**Time:** [Start Time] - [End Time]  
**Attendees:** 
- Person 1
- Person 2
- Person 3

## Agenda

1. Topic 1
2. Topic 2
3. Topic 3

## Discussion Points

### Topic 1
- Key points discussed
- Decisions made

### Topic 2
- Key points discussed
- Decisions made

## Action Items

| Task | Owner | Due Date | Status |
|------|-------|----------|--------|
| Task 1 | Person 1 | Date | Pending |
| Task 2 | Person 2 | Date | Pending |

## Next Steps

- Next meeting scheduled for: [Date]
- Follow-up required on: [Items]`
  },
  {
    id: 'project-plan',
    name: 'Project Plan',
    description: 'Project planning and tracking',
    icon: <Target className="h-6 w-6" />,
    category: 'work',
    content: `# Project Plan: [Project Name]

## Project Overview

**Start Date:** ${new Date().toLocaleDateString()}  
**End Date:** [Target Date]  
**Project Manager:** [Name]  
**Status:** Planning

### Objectives
1. Objective 1
2. Objective 2
3. Objective 3

## Milestones

### Phase 1: Planning
- [ ] Define requirements
- [ ] Create timeline
- [ ] Allocate resources

### Phase 2: Development
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Phase 3: Testing
- [ ] Test scenario 1
- [ ] Test scenario 2
- [ ] User acceptance testing

### Phase 4: Deployment
- [ ] Deployment preparation
- [ ] Go-live
- [ ] Post-deployment support

## Resources

### Team Members
- Developer 1: [Responsibilities]
- Developer 2: [Responsibilities]
- Designer: [Responsibilities]

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Risk 1 | High | Medium | Mitigation strategy |

## Success Metrics

- Metric 1: [Target]
- Metric 2: [Target]
- Metric 3: [Target]`
  },
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    description: 'Personal daily reflection',
    icon: <BookOpen className="h-6 w-6" />,
    category: 'personal',
    content: `# Daily Journal

**Date:** ${new Date().toLocaleDateString()}  
**Weather:** ☀️ Sunny / ☁️ Cloudy / 🌧️ Rainy  
**Mood:** 😊 Great / 😐 Okay / 😔 Challenging

## Morning Reflection

What am I grateful for today?
1. 
2. 
3. 

## Today's Goals

- [ ] Priority 1
- [ ] Priority 2
- [ ] Priority 3

## Notes & Thoughts

[Write your thoughts here...]

## Evening Reflection

### What went well today?

### What could have been better?

### What did I learn?

### Tomorrow's Focus

## Quote of the Day

> "Insert an inspiring quote here"`
  },
  {
    id: 'todo-list',
    name: 'Todo List',
    description: 'Task management template',
    icon: <ListChecks className="h-6 w-6" />,
    category: 'personal',
    content: `# Todo List

**Date:** ${new Date().toLocaleDateString()}

## 🎯 Today's Focus

The one thing I must accomplish today:
- 

## 📋 Tasks

### High Priority
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Medium Priority
- [ ] Task 4
- [ ] Task 5
- [ ] Task 6

### Low Priority
- [ ] Task 7
- [ ] Task 8

## 📅 Upcoming

### This Week
- 

### This Month
- 

## 💡 Ideas & Notes

- 

## ✅ Completed

- [x] Example completed task`
  },
  {
    id: 'code-snippet',
    name: 'Code Documentation',
    description: 'Document code snippets and examples',
    icon: <Code className="h-6 w-6" />,
    category: 'technical',
    content: `# Code Documentation

## Overview

Brief description of what this code does.

## Implementation

### Function/Component Name

**Purpose:** What it does  
**Parameters:** 
- \`param1\` (type): Description
- \`param2\` (type): Description

**Returns:** Description of return value

\`\`\`javascript
function exampleFunction(param1, param2) {
  // Your code here
  return result;
}
\`\`\`

### Usage Example

\`\`\`javascript
// Example of how to use the function
const result = exampleFunction('value1', 'value2');
console.log(result);
\`\`\`

## API Reference

### Endpoints

#### GET /api/endpoint
- **Description:** What this endpoint does
- **Parameters:** 
  - \`id\` (required): Description
- **Response:**
\`\`\`json
{
  "status": "success",
  "data": {}
}
\`\`\`

## Testing

\`\`\`javascript
describe('Function Name', () => {
  it('should do something', () => {
    // Test code
  });
});
\`\`\`

## Notes

- Important consideration 1
- Important consideration 2`
  },
  {
    id: 'study-notes',
    name: 'Study Notes',
    description: 'Academic note-taking template',
    icon: <GraduationCap className="h-6 w-6" />,
    category: 'personal',
    content: `# Study Notes: [Subject/Topic]

**Date:** ${new Date().toLocaleDateString()}  
**Course:** [Course Name]  
**Chapter/Lecture:** [Number/Title]

## 🎯 Learning Objectives

1. Understand...
2. Be able to explain...
3. Apply knowledge of...

## 📚 Key Concepts

### Concept 1
- Definition:
- Importance:
- Examples:

### Concept 2
- Definition:
- Importance:
- Examples:

## 📝 Detailed Notes

[Your detailed notes here...]

## 🔍 Important Formulas/Definitions

1. **Term 1:** Definition
2. **Formula 1:** \`formula here\`

## 💡 Examples & Practice Problems

### Example 1
Problem:
Solution:

### Example 2
Problem:
Solution:

## 🤔 Questions to Review

- [ ] Question 1
- [ ] Question 2
- [ ] Question 3

## 📖 Additional Resources

- Resource 1: [Link/Reference]
- Resource 2: [Link/Reference]

## 🎓 Summary

[Summarize the key takeaways in your own words]`
  }
];

interface DocumentTemplatesProps {
  onSelect: (template: Template) => void;
  onCancel: () => void;
}

export const DocumentTemplates: React.FC<DocumentTemplatesProps> = ({ onSelect, onCancel }) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  const categories = [
    { id: 'all', name: 'All Templates', icon: <FileText className="h-4 w-4" /> },
    { id: 'personal', name: 'Personal', icon: <Lightbulb className="h-4 w-4" /> },
    { id: 'work', name: 'Work', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'technical', name: 'Technical', icon: <Code className="h-4 w-4" /> },
    { id: 'creative', name: 'Creative', icon: <BookOpen className="h-4 w-4" /> }
  ];

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
            leftIcon={category.icon}
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
        {filteredTemplates.map(template => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="card p-4 text-left hover:shadow-lg transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
                {template.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                  {template.name}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {template.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};