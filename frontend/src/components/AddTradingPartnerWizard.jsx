import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle2, Circle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Step1BusinessPartner } from './wizard/Step1BusinessPartner';
import { Step2EDIProfile } from './wizard/Step2EDIProfile';
import { Step3ERPContext } from './wizard/Step3ERPContext';
import { Step4Documents } from './wizard/Step4Documents';
import { Step5Specifications } from './wizard/Step5Specifications';
import { Step6Mapping } from './wizard/Step6Mapping';
import { Step7Transport } from './wizard/Step7Transport';
import { Step8Testing } from './wizard/Step8Testing';
import { Step9GoLive } from './wizard/Step9GoLive';

const STEPS = [
  { id: 1, title: 'Business Partner', description: 'Who are they?' },
  { id: 2, title: 'EDI Profile', description: 'How do they talk EDI?' },
  { id: 3, title: 'ERP & System Context', description: 'System context (optional)', optional: true },
  { id: 4, title: 'Documents', description: 'What flows?' },
  { id: 5, title: 'Specifications', description: 'Teach the system' },
  { id: 6, title: 'Mapping', description: 'Build mappings' },
  { id: 7, title: 'Transport', description: 'How files move' },
  { id: 8, title: 'Testing', description: 'Validate & simulate' },
  { id: 9, title: 'Go Live', description: 'Activate partner' },
];

export const AddTradingPartnerWizard = ({ open, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [formData, setFormData] = useState({
    // Step 1: Business Partner
    businessName: '',
    partnerCode: '',
    role: '',
    industry: '',
    country: '',
    timezone: '',
    businessContact: { name: '', email: '', phone: '' },
    technicalContact: { name: '', email: '', phone: '' },
    status: 'Draft',
    
    // Step 2: EDI Profile
    ediStandard: '',
    version: '',
    functionalGroups: [],
    characterSet: '',
    delimiters: { element: '*', segment: '~', subElement: '>' },
    isaSenderId: '',
    isaReceiverId: '',
    gsIds: { sender: '', receiver: '' },
    
    // Step 3: ERP & System Context (Optional)
    erpContext: {
      partnerERP: {
        system: 'Unknown',
        version: '',
        customName: '',
        hasCustomizations: false,
        notes: '',
      },
      targetSystem: {
        system: '',
        integrationMethod: '',
        dataOwner: '',
      },
    },
    
    // Step 4: Documents
    documents: [],
    
    // Step 5: Specifications
    specFiles: [],
    sampleFiles: [],
    exceptionRules: '',
    
    // Step 6: Mapping
    mappings: [],
    
    // Step 7: Transport
    transportType: '',
    transportConfig: {},
    
    // Step 8: Testing
    testResults: [],
    
    // Step 9: Go Live
    activationDate: '',
    monitoringEnabled: true,
  });

  const updateFormData = (step, data) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const markStepComplete = (step) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      markStepComplete(currentStep);
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    // Mark optional step as skipped (completed but empty)
    markStepComplete(currentStep);
    setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step) => {
    // Allow clicking on completed steps or next step
    if (completedSteps.has(step - 1) || step === currentStep + 1) {
      setCurrentStep(step);
    }
  };

  const handleComplete = () => {
    markStepComplete(currentStep);
    onComplete(formData);
  };

  const progress = (completedSteps.size / STEPS.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1BusinessPartner
            data={formData}
            onChange={(data) => updateFormData(1, data)}
          />
        );
      case 2:
        return (
          <Step2EDIProfile
            data={formData}
            onChange={(data) => updateFormData(2, data)}
          />
        );
      case 3:
        return (
          <Step3ERPContext
            data={formData}
            onChange={(data) => updateFormData(3, data)}
            onSkip={handleSkip}
          />
        );
      case 4:
        return (
          <Step4Documents
            data={formData}
            onChange={(data) => updateFormData(4, data)}
          />
        );
      case 5:
        return (
          <Step5Specifications
            data={formData}
            onChange={(data) => updateFormData(5, data)}
          />
        );
      case 6:
        return (
          <Step6Mapping
            data={formData}
            onChange={(data) => updateFormData(6, data)}
          />
        );
      case 7:
        return (
          <Step7Transport
            data={formData}
            onChange={(data) => updateFormData(7, data)}
          />
        );
      case 8:
        return (
          <Step8Testing
            data={formData}
            onChange={(data) => updateFormData(8, data)}
          />
        );
      case 9:
        return (
          <Step9GoLive
            data={formData}
            onChange={(data) => updateFormData(9, data)}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">Add Trading Partner</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{Math.round(progress)}% Complete</span>
              <span>{completedSteps.size} of {STEPS.length} steps completed</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Step Navigation Sidebar */}
          <div className="w-64 border-r border-border bg-muted/30 p-4 overflow-y-auto">
            <div className="space-y-2">
              {STEPS.map((step) => {
                const isCompleted = completedSteps.has(step.id);
                const isCurrent = currentStep === step.id;
                const isAccessible = completedSteps.has(step.id - 1) || step.id === 1 || step.id === currentStep + 1;

                return (
                  <button
                    key={step.id}
                    onClick={() => handleStepClick(step.id)}
                    disabled={!isAccessible}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : isCompleted
                        ? 'bg-success-bg text-success-foreground hover:bg-success-bg/80'
                        : isAccessible
                        ? 'bg-card hover:bg-muted text-foreground'
                        : 'bg-card text-muted-foreground opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        <Circle className={`w-5 h-5 flex-shrink-0 ${isCurrent ? 'fill-current' : ''}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{step.title}</span>
                          {step.optional && (
                            <Badge variant="secondary" className="text-xs">Optional</Badge>
                          )}
                        </div>
                        <div className="text-xs opacity-75 mt-0.5">{step.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderStepContent()}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {STEPS[currentStep - 1]?.optional && (
              <Button variant="outline" onClick={handleSkip}>
                Skip & Continue
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete} variant="success">
                Complete Setup
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
