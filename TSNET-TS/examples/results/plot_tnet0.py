import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

with open('/app/TSNET-TS/examples/results/Tnet0-valve-closure.json') as f:
    data = json.load(f)

time = data['time']
node2 = data['nodes']['2']

fig, ax = plt.subplots(figsize=(10, 5))
ax.plot(time, node2['head_steady'], label='Steady Friction', linewidth=1.2)
ax.plot(time, node2['head_quasi_steady'], label='Quasi-Steady Friction', linewidth=1.2, linestyle='--')
ax.plot(time, node2['head_unsteady'], label='Unsteady Friction', linewidth=1.2, linestyle=':')

ax.set_xlabel('Time (s)')
ax.set_ylabel('Head (m)')
ax.set_title('Tnet0 Valve Closure — Pressure Head at Node 2')
ax.legend()
ax.grid(True, alpha=0.3)
ax.set_xlim(0, max(time))

plt.tight_layout()
plt.savefig('/app/TSNET-TS/examples/results/Tnet0-valve-closure.png', dpi=150)
print('Plot saved to results/Tnet0-valve-closure.png')
