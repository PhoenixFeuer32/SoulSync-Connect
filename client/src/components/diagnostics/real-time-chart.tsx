import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface RealTimeChartProps {
  data: any[];
  type: 'line' | 'area' | 'bar';
  dataKey: string;
  height?: number;
  color?: string;
}

export default function RealTimeChart({ 
  data, 
  type, 
  dataKey, 
  height = 200, 
  color = 'hsl(246, 83%, 67%)' 
}: RealTimeChartProps) {
  // Process data for chart display
  const chartData = data.slice(-20).map((item, index) => ({
    ...item,
    timestamp: new Date(item.timestamp).toLocaleTimeString(),
    index
  }));

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 17%)" />
            <XAxis 
              dataKey="timestamp" 
              stroke="hsl(215, 20%, 65%)" 
              fontSize={12}
              interval="preserveStartEnd"
            />
            <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(222, 84%, 9%)', 
                border: '1px solid hsl(217, 32%, 17%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)'
              }} 
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: color }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 17%)" />
            <XAxis 
              dataKey="timestamp" 
              stroke="hsl(215, 20%, 65%)" 
              fontSize={12}
              interval="preserveStartEnd"
            />
            <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(222, 84%, 9%)', 
                border: '1px solid hsl(217, 32%, 17%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)'
              }} 
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              fill={color}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 32%, 17%)" />
            <XAxis 
              dataKey="timestamp" 
              stroke="hsl(215, 20%, 65%)" 
              fontSize={12}
              interval="preserveStartEnd"
            />
            <YAxis stroke="hsl(215, 20%, 65%)" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(222, 84%, 9%)', 
                border: '1px solid hsl(217, 32%, 17%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)'
              }} 
            />
            <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        );

      default:
        return null;
    }
  };

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <i className="fas fa-chart-line text-4xl text-muted-foreground mb-2"></i>
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );
}
