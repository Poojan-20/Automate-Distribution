import React from "react";

export const Step = ({ children, completed }) => {
  return (
    <div className="flex-1">
      {children}
      {completed && <div className="h-1 w-full bg-primary mt-2 rounded-full" />}
    </div>
  );
};

export const StepLabel = ({ children }) => {
  return <div className="text-sm font-medium text-center">{children}</div>;
};

export const Stepper = ({ children, activeStep, className = "" }) => {
  // Clone and modify children to add the completed prop
  const stepsWithProps = React.Children.map(children, (child, index) => {
    return React.cloneElement(child, {
      completed: index < activeStep,
    });
  });

  return (
    <div className={`flex gap-4 ${className}`}>
      {stepsWithProps}
    </div>
  );
}; 