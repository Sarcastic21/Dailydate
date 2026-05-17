import React from 'react';
import './Logo.css';

const Logo = ({ size = 'medium', className = '' }) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return '40px';
      case 'medium':
        return '60px';
      case 'large':
        return '80px';
      case 'xlarge':
        return '120px';
      default:
        return '60px';
    }
  };
  
  return (
    <div className={`logo-container ${className}`} style={{ width: getSize(), height: getSize() }}>
      <img 
        src="/logo.png" 
        alt="DailyDate Logo" 
        className="logo-image"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default Logo;
